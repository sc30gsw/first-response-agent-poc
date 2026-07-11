---
description: pnpm, Nuxt, database, and pre-PR workflow for this repository
globs: []
alwaysApply: true
---

# Development Workflow

Use pnpm 9.15.0 and Node.js 24 or newer. Install dependencies before relying on generated Nuxt types or package-local documentation.

## Commands

| Command | Purpose |
| --- | --- |
| `pnpm dev` | Start the Nuxt application and embedded Eve runtime |
| `pnpm test` | Run deterministic Vitest tests |
| `pnpm typecheck` | Run `nuxt typecheck` |
| `pnpm build` | Run the production Nuxt build |
| `pnpm start` | Preview the built Nuxt application |
| `pnpm db:generate` | Generate database migrations through `nuxt db` |
| `pnpm db:migrate` | Apply database migrations through `nuxt db` |

Do not substitute standalone Eve commands for the package scripts. Do not document or run nonexistent `pnpm check`, `pnpm lint`, `pnpm format`, `pnpm eval`, `tsgo`, `oxlint`, `oxfmt`, or `fallow` workflows.

Use pnpm rather than npm or Yarn. Use `pnpm dlx` for one-off package execution unless an existing package script deliberately specifies another command.

## Required quality gate

Before handing off implementation work or opening a PR, run:

```bash
pnpm test
pnpm typecheck
pnpm build
```

Report any command that could not run and the reason. Do not claim success from a narrower check.

## Database workflow

Use `pnpm db:generate` and `pnpm db:migrate`, not raw `drizzle-kit`. Preserve generated migrations and metadata. A local database reset is destructive and must only be performed when the task requires it.
