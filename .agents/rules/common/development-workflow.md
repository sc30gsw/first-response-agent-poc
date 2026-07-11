---
description: eve CLI + pnpm command conventions, tsgo typecheck, fallow, PR pre-check flow
globs: []
alwaysApply: false
---

# Development Workflow

## Commands

This is an **eve** agent app. The package manager is **pnpm**. Development goes through the `eve` CLI (wired into the `package.json` scripts) plus `tsgo` for type-checking and `fallow` for code health.

| Command            | Runs                          | Purpose                                                    |
| ------------------ | ----------------------------- | ---------------------------------------------------------- |
| `pnpm dev`         | `eve dev`                     | Start the local dev server + terminal UI                   |
| `pnpm build`       | `eve build`                   | Compile `.eve/` artifacts and build the host output        |
| `pnpm start`       | `eve start`                   | Serve the built `.output/` app                             |
| `pnpm eval`        | `eve eval`                    | Run evals (see [testing.md](./testing.md))                 |
| `pnpm check`       | `tsgo && oxlint && oxfmt --check` | Type-check + lint + format check (CI / pre-PR gate)    |
| `pnpm fix`         | `oxlint --fix && oxfmt`       | Auto-fix lint + write formatting                           |
| `pnpm typecheck`   | `tsgo`                        | Type-check (uses `@typescript/native-preview`, NOT `tsc`)  |
| `pnpm lint`        | `oxlint`                      | Lint only                                                  |
| `pnpm format`      | `oxfmt`                       | Format (write)                                             |
| `pnpm fallow`      | `fallow`                      | Unused code, duplication, cycles, complexity               |
| `pnpm fallow:audit`| `fallow audit`                | Changed-code gate (run before every commit / push)         |
| `pnpm fallow:dead-code` | `fallow dead-code`       | Unused files, exports, dependencies                        |
| `eve info`         | `pnpm exec eve info`          | Print the discovered surface + diagnostics                 |

Formatting (oxfmt) uses double quotes and semicolons; `oxlint` enforces `import/no-default-export` everywhere except eve slots (`agent/agent.ts`, `agent/channels/**`, `agent/tools/**`, `evals/**`, `*.config.ts`).

## Forbidden

```
// WRONG: this project has no Vite+ (vp), no Vitest, no React tooling
vp dev
vp check
vp test

// WRONG: tsc — type-checking uses tsgo
npx tsc --noEmit

// WRONG: npm / yarn — the package manager is pnpm
npm install
yarn build
```

Use `pnpm dlx` instead of `npx`.

## PR pre-check

Before opening a PR, run:

```bash
pnpm check         # tsgo + oxlint + oxfmt --check (no errors)
pnpm eval          # all evals pass their gates (eve eval --strict in CI)
fallow audit       # changed-code gate is `pass` (required before commit/push)
pnpm build         # eve build succeeds
```

The `fallow audit` gate is also enforced automatically before `git commit` / `git push` by `.claude/hooks/fallow-gate.sh`.

`fallow audit` defaults to `gate=new-only`: only findings introduced by the current changeset block the verdict. See the Fallow task map in [AGENTS.md](/AGENTS.md) for trace/explain subcommands.
