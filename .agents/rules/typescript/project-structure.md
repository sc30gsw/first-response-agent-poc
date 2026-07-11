---
description: Next.js, Eve, server, shared, test, and import ownership boundaries
globs: ["**/*.ts", "**/*.tsx"]
paths:
  - "**/*.ts"
  - "**/*.tsx"
alwaysApply: true
---

# Project Structure and Imports

This is a Next.js App Router full-stack application (React 19) with an embedded Eve agent (`eve/next`).

| Directory | Ownership |
| --- | --- |
| `agent/` | Eve configuration, web channel, instructions, skills, tools, and agent-only helpers (`agent/lib/`, deterministic domain search in `agent/lib/domain/`) |
| `app/` | Next.js App Router UI and thin framework mounts; `app/api/v1/[[...slugs]]/route.ts` only exports the Elysia fetch handler |
| `server/api/` | Elysia HTTP controllers, request/response policy, Zod HTTP contracts, and OpenAPI generation |
| `server/application/` | Framework-independent use cases and typed business/integration failures; never accept `Request`, `Response`, or `Headers` |
| `server/utils/` | Server adapters for authentication, persistence, and other infrastructure |
| `server/db/` | Drizzle schema, client, and forward-only migrations |
| `lib/` | Browser adapters (Better Auth, Eden, TanStack Query keys) and sample data |
| `shared/` | Cross-layer serializable types and helpers |
| `tests/` | Deterministic Vitest tests |

Do not reduce the repository to an Eve-only `agent/` and `evals/` layout. Do not add `evals/` unless `REQUIREMENT.md` and the quality gate are intentionally changed.

## Imports

- Use `@/*` for repository-root-owned modules (`@/server/...`, `@/shared/...`, `@/lib/...`), as configured in `tsconfig.json` paths.
- Use `#lib/*` for `agent/lib/*`; it matches the `package.json` imports mapping (`#*` → `agent/*`) and is for agent-owned code.
- Relative imports are acceptable for nearby files in the same module.
- Avoid deep relative imports such as `../../../`; use the ownership alias instead.

Do not invent `#evals/*`; it is not configured.

## Layering

- Keep Eve-only helpers in `agent/lib/`.
- Keep browser code out of `server/` and server secrets out of client components and `lib/`.
- Keep the Next.js route mount declarative. Elysia controllers own HTTP parsing and status/header conversion, then call `server/application/` with authenticated user IDs and plain DTOs.
- Server Components call the same application service directly instead of self-fetching. Client Components use the Eden adapter through TanStack Query and do not call application endpoints with raw `fetch`.
- Keep database and provider details behind adapters in `server/utils/`; application services depend on their typed interfaces.
- Put cross-layer contracts in `shared/` only when they are serializable and do not pull server or browser dependencies across the boundary.
