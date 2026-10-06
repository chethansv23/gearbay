.DEFAULT_GOAL := help

help: ## Show available commands
	@grep -E '^[a-z-]+:.*?## ' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-14s\033[0m %s\n", $$1, $$2}'

up: ## Build and start everything (infra, 5 services, web UI on :4000)
	docker compose up -d --build --wait

infra: ## Start only Postgres, Redis and Kafka (run services with npm start)
	docker compose up -d --wait postgres redis kafka

install: ## Install backend and web dependencies
	npm install && cd web && npm install

test: test-backend test-web ## Run all backend and frontend tests

test-backend: ## Backend unit + Testcontainers integration tests (needs Docker running)
	npx vitest run

test-unit: ## Backend unit tests only (no Docker needed)
	npx vitest run --project unit

test-web: ## Frontend tests
	cd web && npm test

demo: ## End-to-end walkthrough against the gateway
	./scripts/demo.sh

loadtest: ## Race 50 bookings for one slot and measure availability reads with k6
	docker run --rm -i -v "$(CURDIR)/loadtest":/scripts grafana/k6 run /scripts/booking.js

logs: ## Follow service logs
	docker compose logs -f appointment repair-order inventory notification gateway

down: ## Stop everything (keeps data)
	docker compose down

reset: ## Stop everything and delete all data
	docker compose down -v

.PHONY: help up infra install test test-backend test-unit test-web demo loadtest logs down reset
