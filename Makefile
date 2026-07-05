COMPOSE := $(shell docker compose version >/dev/null 2>&1 && echo docker compose || echo docker-compose)
COMPOSE_FILE=infra/docker-compose.yml

.PHONY: dev test lint migrate seed

dev:
	$(COMPOSE) -f $(COMPOSE_FILE) up --build

test:
	$(COMPOSE) -f $(COMPOSE_FILE) run --rm api pytest
	$(COMPOSE) -f $(COMPOSE_FILE) run --rm web npm run typecheck

lint:
	$(COMPOSE) -f $(COMPOSE_FILE) run --rm api ruff check .
	$(COMPOSE) -f $(COMPOSE_FILE) run --rm web npm run lint

migrate:
	$(COMPOSE) -f $(COMPOSE_FILE) run --rm api python -m applywise.migrations

seed:
	$(COMPOSE) -f $(COMPOSE_FILE) run --rm api python -m applywise.seed
