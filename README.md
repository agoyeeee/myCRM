# ClientOS

**Personal CRM + Sales OS** — track companies, contacts, leads, and the whole pipeline from first touch to recurring invoice, with AI help for lead analysis and outreach.

[![Go](https://img.shields.io/badge/Go-1.26-00ADD8?logo=go&logoColor=white)](https://go.dev)
[![Next.js](https://img.shields.io/badge/Next.js-16-000000?logo=nextdotjs&logoColor=white)](https://nextjs.org)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-17-4169E1?logo=postgresql&logoColor=white)](https://www.postgresql.org)
[![Docker](https://img.shields.io/badge/Docker-ready-2496ED?logo=docker&logoColor=white)](https://www.docker.com)

## Features

- **CRM core** — companies, contacts, leads CRUD; pipeline stages; activities and follow-ups.
- **Sales workflow** — proposals, clients, projects, recurring invoices, revenue tracking.
- **Research & templates** — research records and reusable templates.
- **Notifications** — async delivery via an `asynq` queue plus `cron`-scheduled jobs.
- **Dashboard & global search** — paginated list endpoints, rate limiting, full-text style global search across the workspace.
- **AI** — `POST /ai/analyze-lead/{id}` scores/analyses a lead, `POST /ai/draft-outreach` drafts outreach copy. Talks to any OpenAI-compatible endpoint; disabled unless `LLM_API_KEY` is set.

## Stack

**Backend** — Go 1.26 with `chi` v5, `golang-jwt` v5, `hibiken/asynq` v0.26, `jackc/pgx` v5, `go-redis` v9, `robfig/cron`, `sqlc`.
**Database** — PostgreSQL 17.
**Frontend** — Next.js 16.3.5, React 19.2.8, TanStack Query 5, shadcn/ui (radix-ui), Tailwind 4, zod 4, react-hook-form.

## Structure

```
backend/
  cmd/api          API server
  cmd/migrate      migrations runner
  internal/<domain>/module.go   16 feature modules
  db/queries + db/sqlc          query layer (sqlc-generated)
  db/migrations/001_init.sql
frontend/
  app/(app)/*      18 pages
  components/      shared UI
  lib/hooks/       data hooks
```

## Run

Full stack:

```bash
docker compose up -d --build
```

Migrations run first; API on `:8080`, web on `:3000`.

Local dev:

```bash
docker compose up -d postgres redis
cd backend && go run ./cmd/migrate && JWT_SECRET=<32+ chars> go run ./cmd/api
cd frontend && npx next dev
```

Open http://localhost:3000, register a user, and start adding companies/leads.

## Env

Copy `.env.example` to `.env`.

- Required: `JWT_SECRET` (min 32 chars).
- Optional: `LLM_API_KEY` (enables AI features), `SEED_EMAIL` / `SEED_PASSWORD`.
