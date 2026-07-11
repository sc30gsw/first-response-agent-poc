---
description: eve agent/ authored slots, evals/ sibling, # import alias, lib/ for shared code
globs: ["agent/**/*.ts", "evals/**/*.ts"]
alwaysApply: true
---

# Project Structure

> This rule extends [CODING_GUIDELINE.md](/CODING_GUIDELINE.md) §プロジェクト構造.

eve builds the agent by walking the filesystem under `agent/`. Each directory is an **authored slot**, and the slot a file lands in determines how eve loads it. See `node_modules/eve/docs/reference/project-layout.md`.

## Authored layout

```
my-eve-first-agent/
├── package.json
├── tsconfig.json          # include: agent/**/*.ts, evals/**/*.ts, .eve/**/*.d.ts
├── agent/
│   ├── agent.ts           # runtime config — export default defineAgent(...)
│   ├── instructions.md    # base system prompt
│   ├── instrumentation.ts # telemetry (root-only)
│   ├── channels/          # HTTP / messaging entrypoints (root-only)
│   ├── connections/       # MCP / OpenAPI connections — one per file
│   ├── hooks/             # lifecycle / stream-event subscribers
│   ├── skills/            # on-demand procedures (markdown or module)
│   ├── tools/             # typed executable integrations — one per file
│   ├── schedules/         # recurring jobs (root-only)
│   ├── subagents/         # specialist child agents
│   ├── sandbox/           # sandbox definition + seeded workspace files
│   └── lib/               # shared authored helper code (import-only)
└── evals/                 # scored checks — sibling of agent/, NOT inside it
    ├── evals.config.ts
    └── **/*.eval.ts
```

## Identity comes from the path

You never write a `name` or `id` field on a `define*` call. The file path is the identity:

```
agent/tools/get_weather.ts      →  tool  "get_weather"
agent/connections/linear.ts     →  connection "linear"
agent/skills/summarize.md       →  skill "summarize"
agent/subagents/researcher/     →  subagent "researcher"
```

The root agent's name comes from `package.json` `name`.

## `#` alias (relative paths forbidden)

> Also enforced by a PostToolUse hook in `.claude/settings.json`

The `package.json` `imports` field maps `#*` → `./agent/*` and `#evals/*` → `./evals/*`.

```typescript
// CORRECT
import { formatForecast } from "#lib/forecast";   // → agent/lib/forecast
import { fixtures } from "#evals/data/fixtures";   // → evals/data/fixtures

// WRONG: relative paths — forbidden even within the same directory
import { formatForecast } from "./lib/forecast";
import { helper } from "../lib/helper";
```

`eve`-package imports (`import { defineAgent } from "eve"`) are external and stay as-is.

## Shared code goes in `agent/lib/`

`lib/` is import-only source code that never reaches the sandbox workspace. Put helpers shared across tools/channels/subagents here instead of reaching across slots.

## What does not exist here

This is a backend agent app. There is **no** `src/`, no `features/`, no `routes/`, no React components, and no `~` alias. Do not introduce them.
