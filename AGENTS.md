# Personal Agent Template

Durable personal AI assistant built with Eve and Nuxt.

## PoC Context

This repo is a fork of vercel-labs/personal-agent-template being repurposed as
「複雑不動産案件 初動支援アシスタント」(MarksLife First Response Agent PoC).
**REQUIREMENT.md is the source of truth** for product scope.

Key constraints (REQUIREMENT §8/§10):

- Web channel ONLY — no Slack, iMessage, schedules, or multi-agent
- Dummy JSON case/employee data — no real data connections
- Template features (Slack, Sendblue, Linear, GitHub tools) are unused legacy, not yet removed

## Quick Reference

| Command            | Description                    |
| ------------------ | ------------------------------ |
| `pnpm install`     | Install dependencies           |
| `pnpm dev`         | Start Nuxt + Eve dev server    |
| `pnpm test`        | Run deterministic Vitest tests |
| `pnpm build`       | Production build               |
| `pnpm typecheck`   | TypeScript check               |
| `pnpm db:generate` | Generate Drizzle migrations    |
| `pnpm db:migrate`  | Apply migrations               |

Required env: `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `INTERNAL_API_SECRET` (+ Turso vars on Vercel). See [docs/ENVIRONMENT.md](docs/ENVIRONMENT.md).

## Toolchain & Quality Gates

- pnpm 9.15.0, Node >= 24. Run `pnpm install` first — node_modules may be absent.
- Vitest is configured for deterministic tests under `tests/**/*.test.ts`.
- No lint or format tooling exists. Do not invent lint/format commands.
- Required quality gate: `pnpm test`, `pnpm typecheck`, and `pnpm build`.
- Style: `.editorconfig` only (2-space indent, LF, final newline).
- DB commands go through `nuxt db` (`pnpm db:generate` / `db:migrate`), not raw drizzle-kit.
  Reset local DB: `rm -rf .data/db && pnpm db:migrate`

## PR Conventions

PR titles must follow Conventional Commits (enforced by CI).
Allowed scopes: `deps, app, agent, server, docs`. Subject must not start with uppercase.

## Structure

```
personal-agent-template/
├── agent/          # Eve agent (channels, tools, skills, connections)
├── app/            # Nuxt UI (pages, components, composables)
├── server/         # Nitro API, Drizzle schema, server utils
├── shared/         # Cross-layer types and helpers
└── docs/           # Architecture, environment, customization
```

## Documentation

- [Architecture](docs/ARCHITECTURE.md) — System design, request flows, internal API
- [Environment](docs/ENVIRONMENT.md) — Environment variables
- [Customization](docs/CUSTOMIZATION.md) — Rename agent, add tools, integrations
- [README](README.md) — Quick start and feature overview

## Eve Framework

This project uses Eve with a Nuxt frontend (`eve/nuxt` module). Before writing agent code, read the relevant guide in `node_modules/eve/dist/docs/public/`
(run `pnpm install` first; verify the path exists — it ships inside the eve package).

## Internal API Pattern

The Eve agent calls Nuxt over HTTP:

```
agent/lib/*-internal.ts  →  /api/internal/*  →  server/utils/*
```

Authenticated with `Authorization: Bearer <INTERNAL_API_SECRET>`. See [`server/utils/internal-api.ts`](server/utils/internal-api.ts).

<!-- BEGIN:nextjs-agent-rules -->

# Next.js: ALWAYS read docs before coding

Before any Next.js work, find and read the relevant doc in `node_modules/next/dist/docs/`. Your training data is outdated — the docs are the source of truth.

<!-- END:nextjs-agent-rules -->

## Memory Flow

1. **Session injection** — [`agent/instructions.ts`](agent/instructions.ts) on `session.started`
2. **Agent save** — [`agent/tools/save_memory.ts`](agent/tools/save_memory.ts) with web approval UI
3. **Profile UI** — import, view, edit, delete on Settings → Profile

Categories: [`shared/types/memory.ts`](shared/types/memory.ts). One prose block per category; saves replace the full block.

## Customization Checklist

- [`shared/agent.ts`](shared/agent.ts) — branding
- [`agent/lib/base-instructions.ts`](agent/lib/base-instructions.ts) — persona
- [`agent/channels/slack.ts`](agent/channels/slack.ts) — Slack Connect slug
- [`agent/agent.ts`](agent/agent.ts) — AI model

See [docs/CUSTOMIZATION.md](docs/CUSTOMIZATION.md) for details.
