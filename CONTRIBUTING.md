# Contributing to ApplyWise

Thank you for your interest in contributing. This document describes the development workflow, conventions, and quality gates you need to follow before opening a pull request.

## Table of Contents

- [Development Setup](#development-setup)
- [Project Layout](#project-layout)
- [Workflow](#workflow)
- [Code Style](#code-style)
- [Testing](#testing)
- [Commit Conventions](#commit-conventions)
- [Pull Request Checklist](#pull-request-checklist)

---

## Development Setup

**Prerequisites:** Docker with Compose v2, Git, Node.js ≥ 22, Python ≥ 3.11.

```bash
# Clone and enter the repository
git clone https://github.com/<org>/applywise.git
cd applywise

# Start the full local stack (API, worker, PostgreSQL, Redis, Next.js)
make dev

# In a separate terminal, seed the demo dataset
make seed
```

The frontend is available at <http://localhost:3000>. Sign in with `demo@applywise.dev` using the local email provider.

Environment templates are at [`web/.env.example`](web/.env.example) and [`api/.env.example`](api/.env.example). For local process-based development (outside Docker), copy each to `.env` and adjust as needed. Never commit `.env` files.

---

## Project Layout

```
applywise/
├── api/                  FastAPI backend (src layout, pytest, ruff)
│   ├── src/applywise/    Application source
│   ├── tests/            Unit and integration tests
│   └── alembic/          Database migrations
├── web/                  Next.js App Router frontend (TypeScript, Tailwind)
│   └── src/
│       ├── app/          Pages and API routes
│       ├── components/   Shared React components
│       └── lib/          Utilities, API client, i18n
├── infra/                Operational scripts (backup, smoke tests)
└── .github/workflows/    CI, monitoring, and backup pipelines
```

---

## Workflow

1. **Branch** from `main` using a descriptive name: `feat/cover-letter-editor`, `fix/fit-score-rounding`, `chore/update-deps`.
2. **Make focused commits** — one logical change per commit (see [Commit Conventions](#commit-conventions)).
3. **Run the full test suite** locally before pushing:

   ```bash
   make test
   make lint
   ```

4. Open a **pull request** against `main`. The CI pipeline must be green before merging.

---

## Code Style

### Python (API)

- Formatter and linter: **ruff** (`ruff check .` and `ruff format .`).
- Target: Python 3.11, `from __future__ import annotations` in every module.
- All public functions and classes require type annotations.
- No bare `except`; always catch the narrowest exception type.

```bash
# Check and auto-fix in one step
docker compose -f docker-compose.yml -f docker-compose.dev.yml run --rm api ruff check --fix .
```

### TypeScript (Frontend)

- **ESLint** with `eslint-config-next`; no `any` suppressions in new code.
- Tailwind utilities only — no inline `style` props unless driven by dynamic values that cannot be expressed as utilities.
- Server Components by default; opt into `"use client"` only when necessary.

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml run --rm web npm run lint
```

---

## Testing

### API

```bash
# Unit tests (no database required)
docker compose -f docker-compose.yml -f docker-compose.dev.yml run --rm api pytest -m "not postgres"

# Full suite including PostgreSQL integration tests
make test
```

Tests that require a real PostgreSQL instance with pgvector must be marked `@pytest.mark.postgres`. They run in CI against a service container and locally via `make test`.

New features require accompanying tests. Aim to cover the happy path and at least one error branch. Use the shared fixtures from `tests/conftest.py` rather than duplicating engine/session setup.

### Frontend

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml run --rm web npm run test
docker compose -f docker-compose.yml -f docker-compose.dev.yml run --rm web npm run typecheck
```

---

## Commit Conventions

Commits follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <short imperative summary>
```

| Type | When to use |
|------|-------------|
| `feat` | New user-visible feature |
| `fix` | Bug fix |
| `chore` | Tooling, config, dependency updates |
| `docs` | Documentation only |
| `test` | Tests added or corrected |
| `refactor` | Code change that is neither a fix nor a feature |
| `perf` | Performance improvement |
| `ci` | CI pipeline changes |

**Scope** is optional but encouraged: `api`, `web`, `worker`, `infra`, `db`, `auth`, etc.

**Rules:**
- Subject line ≤ 72 characters, lowercase after the colon, no trailing period.
- Use the imperative mood: *add*, *fix*, *remove* — not *added*, *fixed*, *removed*.
- Breaking changes: append `!` after the type/scope and describe the break in the commit body.
- Do not reference AI tools, code generators, or automated assistants in commit messages.

**Examples:**

```
feat(api): add cover letter generation endpoint
fix(fit-score): clamp domain score to [0, 100]
chore(deps): update next to 15.1.0
test(auth): cover expired token rejection path
docs: add CONTRIBUTING guide
```

---

## Pull Request Checklist

Before requesting review, confirm that all of the following are true:

- [ ] `make test` passes locally (API tests + frontend typecheck/lint/build).
- [ ] `make lint` passes with zero warnings.
- [ ] New or changed behaviour is covered by tests.
- [ ] Database schema changes have a corresponding Alembic migration (`alembic revision --autogenerate -m "<description>"`).
- [ ] No secrets, credentials, or `.env` files are included in the diff.
- [ ] Commit messages follow the conventions above.
- [ ] The PR description explains *what* changed and *why*.
