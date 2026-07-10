COMPOSE := $(shell docker compose version >/dev/null 2>&1 && echo docker compose || echo docker-compose)
DEV_COMPOSE = $(COMPOSE) -f docker-compose.yml -f docker-compose.dev.yml
PROD_COMPOSE = $(COMPOSE) --env-file .env.production -f docker-compose.yml

.PHONY: dev test lint migrate seed deploy-check release-check deploy deploy-status deploy-logs deploy-down backup

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

deploy-check:
	test -f .env.production
	$(PROD_COMPOSE) config --quiet
	$(PROD_COMPOSE) build
	$(PROD_COMPOSE) run --rm --no-deps web node scripts/validate-runtime-env.mjs
	$(PROD_COMPOSE) run --rm --no-deps api python -c "from applywise.settings import validate_runtime_environment; validate_runtime_environment()"

release-check: test lint deploy-check

deploy: release-check
	$(PROD_COMPOSE) up -d --build
	$(PROD_COMPOSE) ps

deploy-status:
	$(PROD_COMPOSE) ps

deploy-logs:
	$(PROD_COMPOSE) logs -f --tail=100

deploy-down:
	$(PROD_COMPOSE) down

backup:
	test -f .env.production
	mkdir -p backups
	$(PROD_COMPOSE) exec -T postgres sh -c 'pg_dump -U "$$POSTGRES_USER" "$$POSTGRES_DB"' > "backups/applywise-$$(date +%Y%m%d-%H%M%S).sql"
