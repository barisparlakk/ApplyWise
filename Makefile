COMPOSE := $(shell docker compose version >/dev/null 2>&1 && echo docker compose || echo docker-compose)
DEV_COMPOSE = $(COMPOSE) -f docker-compose.yml -f docker-compose.dev.yml
PROD_COMPOSE = $(COMPOSE) --env-file .env.production -f docker-compose.yml

.PHONY: dev test lint migrate seed deploy deploy-logs deploy-down

dev:
	$(DEV_COMPOSE) up --build

test:
	$(DEV_COMPOSE) build api web
	$(DEV_COMPOSE) run --rm api pytest
	$(DEV_COMPOSE) run --rm web npm run test

lint:
	$(DEV_COMPOSE) build api web
	$(DEV_COMPOSE) run --rm api ruff check .
	$(DEV_COMPOSE) run --rm web npm run lint

migrate:
	$(DEV_COMPOSE) run --rm migrate

seed:
	$(DEV_COMPOSE) run --rm migrate
	$(DEV_COMPOSE) run --rm api python -m applywise.seed

deploy:
	test -f .env.production
	$(PROD_COMPOSE) up -d --build

deploy-logs:
	$(PROD_COMPOSE) logs -f --tail=100

deploy-down:
	$(PROD_COMPOSE) down
