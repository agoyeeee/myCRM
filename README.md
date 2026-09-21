# ClientOS

Personal CRM + Sales OS. Next.js frontend, Go (Chi + SQLC) backend, PostgreSQL, Redis/Asynq.

## Structure
backend/   Go API (chi, sqlc, JWT, asynq) + db/migrations + db/queries
frontend/  Next.js App Router + shadcn/ui + TanStack Query

## Dev
1. `docker compose up -d postgres redis`
2. `cd backend && go run ./cmd/migrate && JWT_SECRET=<32+ chars> go run ./cmd/api`
3. `cd frontend && npx next dev`
4. Open http://localhost:3000 — register a user, start adding companies/leads.

Full stack: `docker compose up -d --build` (migrate runs first, API at :8080, web at :3000).

## Env
Copy .env.example to .env. Required: JWT_SECRET (min 32 chars). Optional: LLM_API_KEY (enables AI features), SEED_EMAIL/SEED_PASSWORD.
