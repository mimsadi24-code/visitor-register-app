# Visitor Register

A mobile-friendly front desk app for registering visitors and searching the visitor history.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/visitor-register/` — responsive React/Vite app with registration form, dashboard summary, and searchable visitor history.
- `artifacts/api-server/src/routes/visitors.ts` — visitor list, create, search, and summary API handlers.
- `lib/api-spec/openapi.yaml` — source of truth for the visitor API contract.
- `lib/db/src/schema/visitors.ts` — Drizzle schema for saved visitor records.
- `artifacts/visitor-register/src/index.css` — Harbor front desk theme and responsive styles.

## Architecture decisions

- Visitor records use the shared PostgreSQL database so entries persist across refreshes and sessions.
- The API contract is OpenAPI-first and generated client hooks are used by the frontend.
- Search is server-backed across visitor name, phone, host, and visit purpose.
- The interface is a single responsive route with desktop navigation and a compact mobile navigation treatment.

## Product

- Reception staff can record a visitor's name, phone number, person to meet, and purpose of visit.
- Staff can see all-time and today totals, the latest check-in time, and a newest-first visitor history.
- Staff can search the register by visitor, phone, host, or purpose.

## User preferences

No additional preferences provided.

## Gotchas

- Regenerate the API client after changing `lib/api-spec/openapi.yaml`.
- Run `pnpm run typecheck:libs` after changing a shared library schema so leaf package declarations refresh.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
