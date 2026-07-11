---
description: Nuxt, Eve, server, shared, test, and import ownership boundaries
globs: ["**/*.ts", "**/*.vue"]
paths:
  - "**/*.ts"
  - "**/*.vue"
alwaysApply: true
---

# Project Structure and Imports

This is a Nuxt 4 full-stack application with an embedded Eve agent.

| Directory | Ownership |
| --- | --- |
| `agent/` | Eve configuration, web channel, instructions, skills, tools, and agent-only helpers |
| `app/` | Vue UI, pages, layouts, composables, and client utilities |
| `server/` | Nitro routes, server logic, authentication, database schema, and migrations |
| `shared/` | Cross-layer serializable types and helpers |
| `tests/` | Deterministic Vitest tests |

Do not reduce the repository to an Eve-only `agent/` and `evals/` layout. Do not add `evals/` unless `REQUIREMENT.md` and the quality gate are intentionally changed.

## Imports

- Use `#lib/*` or another `#*` import for `agent/*`, as configured in `package.json`.
- Use `~/` for Nuxt app-owned modules.
- Use `~~/` for root-owned modules when needed.
- Use `#shared/` for shared modules in Nuxt-managed code.
- Relative imports are acceptable for nearby files in the same module.
- Avoid deep relative imports such as `../../../`; use the ownership alias instead.

Do not invent `#evals/*`; it is not configured.

## Layering

- Keep Eve-only helpers in `agent/lib/`.
- Keep browser code out of `server/` and server secrets out of `app/`.
- Keep API route handlers thin and place reusable server logic under `server/utils/` or a cohesive server module.
- Put cross-layer contracts in `shared/` only when they are serializable and do not pull server or browser dependencies across the boundary.
