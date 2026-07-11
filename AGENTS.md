# First Response Agent PoC

Proof-of-concept assistant for first response to complex real-estate cases,
built with Eve and Next.js (App Router).

## PoC Context

This repository implements a proof of concept for a complex real-estate case
first-response assistant.
**REQUIREMENT.md is the source of truth** for product scope.

Key constraints (REQUIREMENT §8/§10):

- Web channel ONLY — no external messaging, schedules, or multi-agent
- Dummy JSON case/employee data — no real data connections
- Out-of-scope integrations have been removed. Remaining Eve built-in tools
  (bash, web_search, todo, etc.) are explicitly disabled via `disableTool()`
  stubs in `agent/tools/`.

## Quick Reference

| Command            | Description                                     |
| ------------------ | ----------------------------------------------- |
| `pnpm install`     | Install dependencies                            |
| `pnpm dev`         | Start the Next.js dev server (`next dev`)       |
| `pnpm test`        | Run deterministic Vitest tests                  |
| `pnpm build`       | Production build (`eve build && next build`)    |
| `pnpm typecheck`   | Generate Next route types, then run TypeScript  |
| `pnpm db:generate` | Generate Drizzle migrations (`drizzle-kit`)     |
| `pnpm db:migrate`  | Apply migrations (`drizzle-kit`)                |

Required env: `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL` (+ `TURSO_DATABASE_URL` /
`TURSO_AUTH_TOKEN` on Vercel). Existing environments may use `TURSO_URL` as a
compatibility alias when `TURSO_DATABASE_URL` is unset. See
[docs/ENVIRONMENT.md](docs/ENVIRONMENT.md).

## Toolchain & Quality Gates

- pnpm 9.15.0, Node >= 24. Run `pnpm install` first — node_modules may be absent.
- Vitest is configured for deterministic tests under `tests/**/*.test.ts`.
- No lint or format tooling exists. Do not invent lint/format commands.
- Required quality gate: `pnpm test`, `pnpm typecheck`, and `pnpm build`.
- Style: `.editorconfig` only (2-space indent, LF, final newline).
- DB commands run `drizzle-kit` against `drizzle.config.ts` via the pnpm scripts
  (`pnpm db:generate` / `db:migrate`). Do not run ad-hoc `drizzle-kit` with other
  flags or configs. Reset local DB: `rm -rf .data && pnpm db:migrate`

## PR Conventions

PR titles must follow Conventional Commits (enforced by CI).
Allowed scopes: `deps, app, agent, server, docs`. Subject must not start with uppercase.

## Structure

```
first-response-agent-poc/
├── agent/          # Eve agent (channels, tools, skills, instructions, lib/domain)
├── app/            # Next.js App Router UI (pages, _components/, app/api/**/route.ts)
├── server/         # Elysia API, application services, server utils, Drizzle
├── lib/            # Better Auth/Eden client adapters and sample data
├── shared/         # Cross-layer types and helpers
├── tests/          # Deterministic Vitest tests
└── docs/           # Architecture and environment docs
```

Path aliases (`tsconfig.json`): `@/*` → repository root, `#lib/*` → `agent/lib/*`
(matching `package.json` imports `#*` → `agent/*`).

## Documentation

- [Architecture](docs/ARCHITECTURE.md) — System design and request flows
- [Environment](docs/ENVIRONMENT.md) — Environment variables
- [README](README.md) — Quick start and feature overview

## Eve Framework

This project uses Eve with the Next.js integration (`eve/next` — `withEve` wraps
the config in `next.config.ts`). Before writing agent code, read the relevant
guide in `node_modules/eve/docs/`
(run `pnpm install` first; verify the path exists — it ships inside the eve package).

## Agent Data Access

Agent tools call the deterministic domain layer in-process — there is no internal
HTTP API (the legacy `/api/internal/*` + bearer-secret pattern has been removed):

```
agent/tools/*.ts  →  agent/lib/domain/*  (deterministic search over dummy JSON)
```

The web channel ([`agent/channels/eve.ts`](agent/channels/eve.ts)) authenticates
callers from the verified Better Auth session (root [`auth.ts`](auth.ts)); never
trust a body-supplied identity. Search candidates and ranking are fixed in tool
code — the LLM explains results but must not reorder or invent them.

## Application API

The browser API is the Elysia app mounted at `app/api/v1/[[...slugs]]/route.ts`.
Keep its controllers limited to HTTP validation and plain response conversion:

```
Client Component -> TanStack Query -> lib/api-client.ts (Eden) -> /api/v1
Route Handler -> server/api/ -> server/application/ -> server/utils/ + Drizzle
Server Component -> server/application/ directly (no self-fetch)
```

Expected authentication, validation, authorization, conflict, limit, and I/O
failures use typed `better-result` values inside application code. Unwrap them
only at HTTP, Eve, or TanStack Query boundaries; never serialize `Result`,
`TaggedError`, `Error`, or `Response` instances as API or tool data.

Authentication, same-origin checks, request-body policy, and ETag/If-Match
parsing belong to `server/api/`. Application services receive an authenticated
user ID, plain DTOs, and an explicit revision, and depend only on repository
interfaces.

<!-- BEGIN:nextjs-agent-rules -->

# Next.js: ALWAYS read docs before coding

Before any Next.js work, find and read the relevant doc in `node_modules/next/dist/docs/`. Your training data is outdated — the docs are the source of truth.

<!-- END:nextjs-agent-rules -->
