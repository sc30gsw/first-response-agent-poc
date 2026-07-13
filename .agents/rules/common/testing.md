---
description: Vitest TDD boundaries and the repository quality gate
globs: ["tests/**/*.test.{ts,tsx}", "agent/**/*.ts", "server/**/*.ts", "shared/**/*.ts"]
paths:
  - "tests/**/*.test.{ts,tsx}"
  - "agent/**/*.ts"
  - "server/**/*.ts"
  - "shared/**/*.ts"
alwaysApply: true
---

# Testing

This repository uses deterministic Vitest tests under `tests/**/*.test.{ts,tsx}`. The default environment is node; UI component tests use a `.tsx` file with a leading `// @vitest-environment jsdom` pragma and assert public DOM behavior via Testing Library. It does not use Eve evals as its required test suite.

## TDD workflow

For new behavior, work in vertical slices:

1. Add a failing test at an agreed public boundary.
2. Implement the smallest behavior that passes.
3. Refactor while keeping the suite green.
4. Move to the next observable behavior.

Do not write a complete horizontal test layer before implementation.

## Test boundaries

Prefer tests for public domain search, ranking, evidence, safety results, invalid and duplicate dummy data, consultation drafts, anonymous authentication, and authenticated HTTP behavior.

Assert public outcomes. Do not couple tests to internal call counts, React component state, or database row layout.

Do not add Playwright or nondeterministic LLM-dependent CI tests. After UI changes, perform a manual browser smoke test when the environment is available.

## Required commands

```bash
pnpm test
pnpm typecheck
pnpm build
```
