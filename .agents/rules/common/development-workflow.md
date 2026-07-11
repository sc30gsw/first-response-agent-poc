---
description: pnpm, Next.js, database, and pre-PR workflow for this repository
globs: []
alwaysApply: true
---

# Development Workflow

Use pnpm 9.15.0 and Node.js 24 or newer. Install dependencies before relying on package-local documentation or generated types.

## Commands

| Command | Purpose |
| --- | --- |
| `pnpm dev` | Start the Next.js dev server (`next dev`) |
| `pnpm test` | Run deterministic Vitest tests |
| `pnpm typecheck` | Run `tsc --noEmit -p tsconfig.json` |
| `pnpm build` | Run `eve build` then `next build` |
| `pnpm start` | Serve the production Next.js build |
| `pnpm db:generate` | Generate Drizzle migrations via `drizzle-kit generate` |
| `pnpm db:migrate` | Apply Drizzle migrations via `drizzle-kit migrate` |

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

Use `pnpm db:generate` and `pnpm db:migrate`; both run `drizzle-kit` against `drizzle.config.ts`. Do not bypass the package scripts with ad-hoc `drizzle-kit` invocations using other flags or configs. Preserve generated migrations and metadata. A local database reset (`rm -rf .data && pnpm db:migrate`) is destructive and must only be performed when the task requires it.
