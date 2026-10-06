create extension if not exists btree_gist;

create table dealer (
    id          varchar(32) primary key,
    name        varchar(120) not null,
    city        varchar(60)  not null,
    timezone    varchar(40)  not null,
    open_time   time         not null,
    close_time  time         not null
);

create table service_bay (
    id           bigint primary key,
    dealer_id    varchar(32) not null references dealer (id),
    name         varchar(60) not null,
    vehicle_type varchar(8)  not null check (vehicle_type in ('CAR', 'BIKE')),
    unique (dealer_id, name)
);

create table appointment (
    id              uuid primary key,
    dealer_id       varchar(32)  not null references dealer (id),
    bay_id          bigint       not null references service_bay (id),
    customer_name   varchar(120) not null,
    customer_phone  varchar(20)  not null,
    customer_email  varchar(120),
    vehicle_type    varchar(8)   not null,
    vehicle_number  varchar(20)  not null,
    vehicle_make    varchar(40),
    vehicle_model   varchar(60),
    service_type    varchar(32)  not null,
    slot_start      timestamptz  not null,
    slot_end        timestamptz  not null,
    status          varchar(16)  not null,
    idempotency_key varchar(80),
    notes           varchar(500),
    odometer_km     integer,
    cancel_reason   varchar(200),
    created_at      timestamptz  not null,
    updated_at      timestamptz  not null,
    version         bigint       not null,
    constraint ck_appointment_slot check (slot_end > slot_start),
    constraint uk_appointment_idempotency_key unique (idempotency_key),
    -- The core invariant: one bay can never hold two live bookings that overlap in time.
    -- Enforced by Postgres, so it holds under concurrency and across service instances.
    constraint ex_appointment_bay_overlap exclude using gist (
        bay_id with =,
        tstzrange(slot_start, slot_end, '[)') with &&
    ) where (status <> 'CANCELLED')
);

create index ix_appointment_dealer_slot on appointment (dealer_id, slot_start);

create table outbox_event (
    id             uuid primary key,
    topic          varchar(100) not null,
    aggregate_type varchar(40)  not null,
    aggregate_id   varchar(64)  not null,
    event_type     varchar(60)  not null,
    payload        jsonb        not null,
    created_at     timestamptz  not null default now(),
    published_at   timestamptz
);
create index ix_outbox_unpublished on outbox_event (created_at) where published_at is null;

create table processed_event (
    event_id     uuid primary key,
    processed_at timestamptz not null default now()
);
