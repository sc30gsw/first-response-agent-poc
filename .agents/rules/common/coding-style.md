---
description: Core coding style — immutability, naming, file size, # imports, eve export rules
globs: ["agent/**/*.ts", "evals/**/*.ts"]
alwaysApply: true
---

# Coding Style

Full conventions are in [CODING_GUIDELINE.md](/CODING_GUIDELINE.md) §コードスタイル. The rules below highlight the most critical points and those enforced by hooks.

## Immutability

ALWAYS return new values; NEVER mutate in place:

```typescript
// CORRECT: return new copy
const updated = { ...session, status: "done" };

// WRONG: mutates original
session.status = "done";
```

## File size

- 200–400 lines typical
- 800 lines maximum — extract helpers into `agent/lib/` when approaching this limit
- One primary responsibility per file (one tool / connection / channel per file)

## Naming

| Target          | Convention       | Example                       |
| --------------- | ---------------- | ----------------------------- |
| Variables / fn  | lowerCamelCase   | `cityName`, `getForecast`     |
| Types           | UpperCamelCase   | `Forecast`, `GetWeatherInput` |
| Constants       | UPPER_SNAKE_CASE | `MAX_RETRY_COUNT`             |
| Files           | kebab-case       | `get-weather.ts`, `forecast.ts` |

Tool/connection/skill **filenames** also become the eve identity (e.g. `agent/tools/get_weather.ts` → tool `get_weather`); match the identity you want.

## Exports

eve resolves authored slots by **default export**. Do not ban it.

```typescript
// CORRECT: authored slots (agent.ts, channels/, tools/, connections/, schedules/, subagents/)
export default defineAgent({ model: "anthropic/claude-sonnet-4.6" });

// CORRECT: agent/lib/ shared helpers use named exports
export function formatForecast(f: Forecast) { /* ... */ }

// WRONG: a named export where eve expects the default-exported define* slot
export const agent = defineAgent({ /* ... */ });
```

## Function style & type inference

> Both live in [CODING_GUIDELINE.md](/CODING_GUIDELINE.md) §エクスポートと関数スタイル / §型推論を優先する, are NOT hook-enforced, and Claude defaults to the wrong choice on both.

**Top-level public helpers use `function` declarations, not arrow functions** (a tool's `execute` and inline callbacks are exempt):

```typescript
// CORRECT
export function toSummary(r: WeatherResult) {
  return { city: r.city, condition: r.condition };
}

// WRONG: arrow for a top-level public helper
export const toSummary = (r: WeatherResult) => ({ city: r.city });
```

**Prefer inference over explicit return-type annotations** — annotate only when inference yields `unknown`/`any`, or at an explicit public API boundary:

```typescript
// CORRECT: return type inferred
export function toSummary(r: WeatherResult) {
  return { city: r.city, condition: r.condition };
}

// WRONG: redundant annotation TypeScript can infer
export function toSummary(r: WeatherResult): WeatherSummary { /* ... */ }
```

## Hook-backed bans

> Also enforced by a PostToolUse hook in `.claude/settings.json`

- **No `interface`** — use `type` everywhere.
- **No relative imports** — always use the `#` alias (`#*` → `agent/*`, `#evals/*` → `evals/*`), even within the same directory. `eve`-package imports stay as-is.

```typescript
// WRONG: relative paths, even when the file is adjacent
import { formatForecast } from "./forecast";
import { helper } from "../lib/helper";

// CORRECT: always #
import { formatForecast } from "#lib/forecast";
import { helper } from "#lib/helper";
```

## Logging (recommendation, not enforced)

Prefer eve instrumentation (`agent/instrumentation.ts`, OpenTelemetry) over `console.log` for anything you want to keep. Stray `console.log` is fine while debugging but should not land in committed code.
