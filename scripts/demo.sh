#!/usr/bin/env bash
# End-to-end walkthrough through the gateway: book a bike and a car, check the bike in,
# run the parts-reservation saga (one success, one stock-out), complete and invoice.
# Requires: curl, jq, and the stack running (make up).
set -euo pipefail

API=${API:-http://localhost:9080/api}
DEALER=${DEALER:-GB-BLR-IND}
DATE=$(date -v+1d +%F 2>/dev/null || date -d tomorrow +%F)
PHONE="98450$(printf '%05d' $((RANDOM % 100000)))"

step() { printf '\n\033[1;36m== %s\033[0m\n' "$*"; }
post() { curl -fsS -X POST "$API$1" -H 'Content-Type: application/json' "${@:3}" -d "$2"; }
wait_for() { # wait_for <url> <jq-condition>
  for _ in $(seq 1 30); do
    body=$(curl -fsS "$API$1") && echo "$body" | jq -e "$2" >/dev/null && { echo "$body"; return; }
    sleep 0.5
  done
  echo "Timed out waiting for $1 to satisfy $2" >&2; exit 1
}
first_free() { # first_free <vehicleType> <serviceTypes, comma-separated>
  curl -fsS "$API/appointments/availability?dealerId=$DEALER&vehicleType=$1&serviceTypes=$2&date=$DATE" \
    | jq -r '[.slots[] | select(.freeBays > 0)][0].start // empty'
}

printf 'Waiting for the gateway'
for _ in $(seq 1 60); do curl -fs "$API/dealers" >/dev/null 2>&1 && break; printf '.'; sleep 1; done; echo

step "Dealers"
curl -fsS "$API/dealers" | jq -c '.[] | {id, name, bayCount}'

step "Bike general-service availability at $DEALER on $DATE"
curl -fsS "$API/appointments/availability?dealerId=$DEALER&vehicleType=BIKE&serviceTypes=GENERAL_SERVICE&date=$DATE" \
  | jq -c '{durationMinutes, slots: [.slots[:6][] | "\(.start) free=\(.freeBays)"]}'

BIKE_SLOT=$(first_free BIKE GENERAL_SERVICE)
[ -n "$BIKE_SLOT" ] || { echo "No free bike slots on $DATE; run 'make reset' to start fresh"; exit 1; }
KEY=$(uuidgen)
BOOK_BIKE=$(jq -n --arg d "$DEALER" --arg p "$PHONE" --arg s "${DATE}T${BIKE_SLOT}" '{
  dealerId: $d, customerName: "Asha Rao", customerPhone: $p, vehicleType: "BIKE",
  vehicleNumber: "KA03 HB 1234", vehicleMake: "Royal Enfield", vehicleModel: "Classic 350",
  serviceTypes: ["GENERAL_SERVICE"], slotStart: $s }')

step "Book the bike for $BIKE_SLOT (Idempotency-Key $KEY)"
BIKE=$(post /appointments "$BOOK_BIKE" -H "Idempotency-Key: $KEY")
echo "$BIKE" | jq -c '{id, status, bayId, localStart, localEnd}'
APPT=$(echo "$BIKE" | jq -r .id)

step "Retry with the same Idempotency-Key -> same appointment, HTTP 200 not 201"
curl -sS -o /dev/null -w 'HTTP %{http_code}\n' -X POST "$API/appointments" -H 'Content-Type: application/json' \
  -H "Idempotency-Key: $KEY" -d "$BOOK_BIKE"

step "A car-only job for a bike is rejected"
post /appointments "$(echo "$BOOK_BIKE" | jq '.serviceTypes = ["WHEEL_ALIGNMENT"]')" 2>/dev/null \
  || curl -sS -X POST "$API/appointments" -H 'Content-Type: application/json' \
       -d "$(echo "$BOOK_BIKE" | jq '.serviceTypes = ["WHEEL_ALIGNMENT"]')" | jq -c '{status, code, detail}'

CAR_SLOT=$(first_free CAR AC_SERVICE,OIL_CHANGE)
step "Book a car AC service + oil change (two services, one 2-hour slot) for $CAR_SLOT"
post /appointments "$(jq -n --arg d "$DEALER" --arg p "$PHONE" --arg s "${DATE}T${CAR_SLOT}" '{
  dealerId: $d, customerName: "Asha Rao", customerPhone: $p, vehicleType: "CAR",
  vehicleNumber: "KA01 MJ 4321", vehicleMake: "Maruti Suzuki", vehicleModel: "Baleno",
  serviceTypes: ["AC_SERVICE", "OIL_CHANGE"], slotStart: $s }')" | jq -c '{id, vehicleType, serviceTypes, bayId, localStart, localEnd}'

step "Check the bike in -> appointment-service emits AppointmentCheckedIn -> repair order opens"
post "/appointments/$APPT/check-in" '{"odometerKm": 18500}' | jq -c '{id, status}'
RO=$(wait_for "/repair-orders?dealerId=$DEALER" "any(.[]; .appointmentId == \"$APPT\")" \
  | jq -r ".[] | select(.appointmentId == \"$APPT\") | .id")
curl -fsS "$API/repair-orders/$RO" | jq -c '{roNumber, status, vehicleType, serviceTypes, labourAmount}'

step "Assign a technician"
post "/repair-orders/$RO/assign" '{"technician": "Ravi K"}' | jq -c '{roNumber, status, technician}'

step "Request parts (saga): oil + spark plug + brake fluid"
post "/repair-orders/$RO/parts" '{"lines":[{"sku":"OIL-10W30-1L","quantity":1},{"sku":"SPARK-PLUG-BIKE","quantity":1},{"sku":"BRAKE-FLUID-DOT4","quantity":1}]}' \
  | jq -c '{status}'
wait_for "/repair-orders/$RO" '.status == "IN_PROGRESS"' | jq -c '{status, parts: [.parts[] | "\(.sku) x\(.quantity) \(.status) @\(.unitPrice)"]}'

step "Request a chain kit when stock is short -> inventory rejects, order returns to IN_PROGRESS"
post "/repair-orders/$RO/parts" '{"lines":[{"sku":"CHAIN-KIT","quantity":2}]}' | jq -c '{status}'
wait_for "/repair-orders/$RO" '.status == "IN_PROGRESS"' | jq -c '{status, note}'

step "Complete and invoice (labour + reserved parts + 18% GST)"
post "/repair-orders/$RO/complete" '{}' | jq -c '{roNumber, status, labourAmount, partsAmount, taxAmount, totalAmount}'

step "Inventory after completion (reserved stock is now consumed)"
sleep 1
curl -fsS "$API/parts/$DEALER/SPARK-PLUG-BIKE" | jq -c '{sku, onHand, reserved, available}'

step "Messages sent to $PHONE"
sleep 1
curl -fsS "$API/notifications?recipient=$PHONE" | jq -r 'reverse | .[] | "[\(.channel)] \(.message)"'

printf '\n\033[1;32mDone.\033[0m Web UI: http://localhost:4000\n'
