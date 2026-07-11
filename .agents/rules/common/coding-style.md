---
description: Repository-wide TypeScript, naming, exports, formatting, and comment conventions
globs: ["**/*.ts", "**/*.tsx"]
paths:
  - "**/*.ts"
  - "**/*.tsx"
alwaysApply: true
---

# Coding Style

Follow `CODING_GUIDELINE.md`. This repository is a Next.js App Router application with an embedded Eve agent, so conventions must work across `agent/`, `app/`, `server/`, `lib/`, and `shared/`.

## TypeScript

- Prefer `type`; use `interface` only when declaration merging or an external contract benefits from it.
- Prefer inferred return types for internal functions. Annotate public boundaries or values that would widen to `any` or `unknown`.
- Derive related types with `z.infer`, `Pick`, `Omit`, indexed access, or other utility types instead of duplicating fields.
- Use `as const satisfies` when retaining literal values while checking an object contract.
- Narrow `unknown`; do not use assertions to bypass validation.
- Prefer immutable transformations when they clarify data flow. Contained local mutation is allowed when it is simpler and does not escape.

## Naming and files

| Target | Convention |
| --- | --- |
| Variables and functions | `lowerCamelCase` |
| Types and React components | `UpperCamelCase` |
| True constants | `UPPER_SNAKE_CASE` |
| General files | kebab-case where practical |
| Eve tool files | snake_case ASCII; the filename is the model-visible tool name |

Keep one primary responsibility per file. Do not enforce arbitrary line-count limits; extract code when cohesion, readability, or testability improves.

## Functions and exports

- Use named exports for reusable helpers, schemas, constants, and types.
- Use default exports where Eve or Next.js expects them: Eve authored slots (`agent/agent.ts`, channels, tools), App Router convention files (`page.tsx`, `layout.tsx`, `error.tsx`), and configuration files. Route handlers (`route.ts`) use named `GET`/`POST` exports.
- Prefer function declarations for top-level exported helpers.
- Arrow functions are appropriate for inline callbacks, closures, and framework configuration.

## Formatting and comments

Follow `.editorconfig`: two spaces, LF, UTF-8, trimmed trailing whitespace, and a final newline. No repository formatter is configured, so match the surrounding quote and semicolon style.

Comments explain why, a constraint, or a trade-off. Do not restate code. TODOs should name a concrete follow-up condition and include an owner or issue when one exists; do not invent deadlines.
