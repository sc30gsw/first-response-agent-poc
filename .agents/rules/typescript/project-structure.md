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
| `app/` | Next.js App Router UI: pages, layouts, shared components in `app/_components/`, and route handlers in `app/api/**/route.ts` |
| `server/` | Server logic, authentication, Drizzle schema, and migrations |
| `lib/` | Client-side helpers (Better Auth client) and sample data |
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
- Keep route handlers thin and place reusable server logic under `server/utils/` or a cohesive server module.
- Put cross-layer contracts in `shared/` only when they are serializable and do not pull server or browser dependencies across the boundary.
