---
description: eve evals — defineEval, the t driver/assertion surfaces, gate vs soft, eve eval
globs: ["evals/**/*.eval.ts", "evals/**/*.ts"]
alwaysApply: true
---

# Testing (eve evals)

> Full guidance is in [CODING_GUIDELINE.md](/CODING_GUIDELINE.md) §評価（evals）. Authoring reference: `node_modules/eve/docs/evals/`.

This is a backend agent app. There is **no** Vitest, no React Testing Library, no DOM queries. Behavior is verified with **eve evals**: scored checks that drive the agent over the real HTTP surface and grade what comes back.

## Placement

Evals live under `evals/` (a sibling of `agent/`), in `*.eval.ts` files. The path is the eval's identity — no `id`/`name` field. Each `evals/` tree needs exactly one `evals.config.ts`.

```
evals/
├── evals.config.ts
├── smoke.eval.ts
└── weather/
    └── brooklyn-forecast.eval.ts   # id: weather/brooklyn-forecast
```

## `defineEval`

An eval is a single `async test(t)`. Drive the agent with `t` and assert on the run with the same `t`:

```typescript
import { defineEval } from "eve/evals";
import { includes } from "eve/evals/expect";

export default defineEval({
  description: "Weather agent answers and uses the right tool.",
  async test(t) {
    await t.send("What is the weather in Brooklyn?");
    t.completed();
    t.calledTool("get_weather");
    t.check(t.reply, includes("Sunny"));
  },
});
```

## Three assertion surfaces

1. **Run-level methods** read the whole run: `t.completed()`, `t.calledTool(name)`, `t.usedNoTools()`, `t.toolOrder([...])`, `t.outputMatches(schema)`. Gate by default.
2. **`t.check(value, assertion)`** grades a value with a builder from `eve/evals/expect`: `includes` / `equals` / `matches` (gates) and `similarity` (soft).
3. **`t.judge.autoevals.*`** is LLM-as-judge — soft, uses the configured judge model, never the agent under test.

## Gate vs soft

- **Gate** (hard): a miss marks the eval `failed` and `eve eval` exits non-zero. Run-level methods, `includes`, `equals`, `matches`.
- **Soft** (tracked): below-threshold marks `scored`, fatal only under `--strict`. `similarity` and every `t.judge.*`.
- Override per assertion: `.gate(threshold?)`, `.soft(threshold?)`, `.atLeast(threshold)`.

## Run them

```bash
eve eval                       # all evals against a local dev server
eve eval weather               # one eval, or everything under evals/weather/
eve eval --strict              # soft threshold misses also fail (use in CI)
```

Assert behavior with `t.completed()` plus one or two content checks. Keep dataset fixtures in `evals/data/`. Reach for a judge only when deterministic builders can't capture "correct".

## Related skills

- `better-result-adopt` — Result patterns for tool/handler code under test
