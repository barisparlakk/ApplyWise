# Changelog

All notable changes to ApplyWise are documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
Versions align with Git tags on `main`. Unreleased changes accumulate under
`[Unreleased]` until a tag is cut.

---

## [Unreleased]

---

## [0.4.0] — 2026-07-13

### Added

- **Job import from public board APIs.** ApplyWise now accepts Greenhouse and
  Lever posting URLs, reconstructs the provider-owned API endpoint from
  validated identifiers, and fetches the structured posting without crawling
  search pages or submitting applications.
- **Goal tracking.** Users can set a weekly application target with an
  optional role filter and target date. The dashboard surfaces live pace
  against the active goal.
- **Application event timeline.** Status transitions are recorded as
  structured events; the application detail view renders a chronological
  activity log.
- **Embedding provenance.** Every stored vector carries the model name that
  produced it. The migration clears hash-based legacy vectors before semantic
  retrieval resumes, preventing silent cross-model score corruption.
- **Resume version library.** Tailored CV variants can be created per target
  role, named, and linked to applications for traceability.
- **Grounded company profiles.** An AI step analyzes each saved job post and
  produces interview angles, projects to emphasise, and smart questions to
  ask, stored per application.
- **Skill graph with shortest readiness paths.** Prerequisite relationships
  between skills are modelled as a directed graph; the roadmap surfaces the
  minimum learning path from current evidence to each target skill.
- **Dramatiq background worker.** Resume and GitHub repository embeddings are
  queued through Redis so upload requests return immediately. Job analysis
  queues embedding repair work after a provider failure.
- **Cloudflare Workers AI integration.** Schema-validated qualitative output
  and multilingual embeddings via `@cf/meta/llama-3.1-8b-instruct-fast` and
  `@cf/google/embeddinggemma-300m`. `AI_ALLOW_LOCAL_FALLBACK` keeps
  deterministic analysis available after quota or provider failures.
- **Free public beta topology.** `render.yaml` and `Dockerfile.render-free`
  run Next.js and FastAPI in a single Render Free web service backed by Neon
  PostgreSQL and a Render Free Key Value instance for quota enforcement.
- **Monitoring and encrypted backups.** `monitor.yml` runs public health,
  security-header, login, and privacy smoke checks every six hours.
  `backup.yml` creates daily AES-256 encrypted PostgreSQL dumps retained for
  seven days as GitHub Actions artifacts.
- **Production hardening.** Runtime validation rejects development secrets,
  default credentials, wildcard hosts, non-HTTPS origins, placeholder support
  details, and missing external LLM configuration at startup.

### Changed

- Rate limiting now uses Redis-backed sliding windows shared across API and
  worker processes. Quota checks fail closed when Redis is unavailable.
- The frontend proxy injects a short-lived backend JWT from the encrypted
  Auth.js session; the browser never receives the bearer token.
- Neon-style `postgresql://` URLs are normalised to the configured psycopg
  driver automatically.

---

## [0.3.0] — 2026-07-06

### Added

- **Hybrid fit score engine.** Python computes seven weighted component scores
  (skill match, project relevance, experience, education, language, domain,
  profile quality) and a deterministic total. The AI provider supplies
  structured qualitative feedback without affecting the numeric score.
- **Interview preparation generator.** Produces focus-area questions grounded
  in the user's resume, projects, and the analyzed job post.
- **Learning roadmap generator.** Derives a day-by-day skill acquisition plan
  from fit analysis gaps, linked to the application and stored for retrieval.
- **Application tracker.** Manages the full lifecycle from `saved` through
  `offer` or `rejected`, with deadline, applied-date, and interview-date
  fields and a free-text notes area.
- **GitHub repository analyzer.** Fetches README, language breakdown, file
  tree, and deterministic engineering signals (CI, tests, Docker, docs) via
  the GitHub REST API. AI summarises qualitative strengths and tech stack.
- **Resume upload and parsing.** Accepts PDF, DOCX, and plain text. Extracts
  structured education, experience, skills, and project sections. Chunks and
  embeds the content for semantic retrieval.
- **pgvector semantic search.** HNSW indexes on resume, repository, and job
  post embeddings enable cosine similarity retrieval across all scored
  entities.
- **Alembic migration pipeline.** Schema versioned from `0001` (initial
  models) through `0007` (application tracker fields).

### Changed

- Job post analysis moved to a structured extraction model with explicit
  fields for required skills, responsibilities, seniority, domain, hidden
  expectations, and English requirement.

---

## [0.2.0] — 2026-07-05

### Added

- **Profile builder.** Captures education level, skills, GitHub URL, target
  roles, preferred location, internship type, languages, and experience level.
- **Google OAuth provider.** Optional alongside the local email provider used
  for demo and local development.
- **Next.js App Router frontend.** TypeScript, Tailwind CSS, shadcn/ui
  component config, and a same-origin `/api/backend` proxy. The browser never
  reaches the FastAPI port directly.
- **Auth.js session layer.** Encrypts the session server-side and exchanges a
  short-lived JWT with the backend on every proxied request.
- **Docker Compose topology.** Production base (`docker-compose.yml`) with
  private backend network, and a development override (`docker-compose.dev.yml`)
  with hot reload and published data-service ports.
- **CI pipeline.** GitHub Actions runs API tests and lint, frontend
  typecheck/lint/build, production dependency audit, Compose validation, and
  both production image builds on every pull request and push to `main`.
- **Dependabot.** Weekly checks across npm, Python, Docker, and Actions
  dependency surfaces.

---

## [0.1.0] — 2026-07-05

### Added

- Initial monorepo scaffold: `api/` (FastAPI, src layout), `web/` (Next.js),
  `docker-compose.yml`, `Makefile`, and root `README.md`.
- SQLAlchemy models for `User`, `Profile`, `Resume`, `JobPost`, and
  `Application` with UUID primary keys and UTC timestamps.
- Alembic configured with pgvector-aware `env.py`.
- FastAPI application with CORS, GZip, TrustedHost middleware, `/health`,
  and `/ready` endpoints.
- Authentication skeleton: JWT creation, decoding, and user auto-provisioning
  on first sign-in.

---

[Unreleased]: https://github.com/barisparlakk/ApplyWise/compare/v0.4.0...HEAD
[0.4.0]: https://github.com/barisparlakk/ApplyWise/compare/v0.3.0...v0.4.0
[0.3.0]: https://github.com/barisparlakk/ApplyWise/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/barisparlakk/ApplyWise/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/barisparlakk/ApplyWise/releases/tag/v0.1.0
