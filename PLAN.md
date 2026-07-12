# PLAN: Streaming Generative UI for `analyze_case` with OpenUI

This plan replaces the fixed, all-at-once rendering of the `analyze_case` report card
with a streaming, model-generated layout powered by OpenUI
(`@openuidev/react-lang` / `@openuidev/lang-core`). It is written to be executed by
another model/agent without additional context. All product constraints in
`REQUIREMENT.md`, `AGENTS.md`, and `.agents/rules/common/product-scope.md` remain binding.

> Note: the previous contents of this file (implementation handoff) are preserved in
> git history (`git log -- PLAN.md`).

---

## 1. Goal & Motivation

**Current behavior:** the Eve agent calls the deterministic `analyze_case` tool, and the
client renders its output as a single large hand-coded React card
(`AnalysisReport` in `app/_components/tool-results.tsx`, ~419 lines). The report appears
all at once after the tool completes — no progressive build-up.

**Target behavior:** after `analyze_case` completes, the agent streams an OpenUI Lang
program describing the report layout. The client renders it incrementally with
`<Renderer isStreaming />`, so sections (summary, priority, missing info, evidence,
actions) appear progressively while the model adapts section order, emphasis, headings,
and connective prose to the specific case.

**Non-goal:** this is NOT a chat-shell replacement. `useEveAgent`, the Eve channel,
Better Auth, thread persistence, and all other tool cards stay exactly as they are.

---

## 2. Decisions (locked-in, from design interview)

| # | Question | Decision |
|---|----------|----------|
| 1 | Scope | Tool-result cards only — chat shell untouched |
| 2 | Data binding | **Reference-ID scheme**: OpenUI components receive only IDs/section refs; real data is resolved from the zod-validated tool output via React context. The LLM can never inject or reorder values. |
| 3 | Generation & transport | The Eve agent emits OpenUI Lang inside a fenced block (` ```openui `) in its normal streamed text response. No new API route, no second LLM call. |
| 4 | Fallback | Keep the existing fixed cards. If the openui block is missing or invalid after the stream ends, render the current `AnalysisReport` unchanged. |
| 5 | Library granularity | Domain block components (props = refs only) + a few generic layout/text primitives (`Stack`, `Section`, `Note`) so the LLM controls order, headings, and short connective text. |
| 6 | Target tools | `analyze_case` only (initial + reanalysis). Other cards (`search_similar_cases`, `search_guides`, `search_experts`, `draft_consultation_request`) stay fixed; listed as optional Phase 5. |
| 7 | Prompt/renderer sync | **Build-time generation via `@openuidev/cli`**: `openui generate` produces the system-prompt fragment and JSON schema from the single library source. Generated artifacts are committed. |

---

## 3. Architecture Overview

```
                      agent side (Eve)                          client side (Next.js)
┌──────────────────────────────────────────────┐   ┌─────────────────────────────────────────┐
│ agent/instructions.ts                        │   │ app/_components/eve-chat.tsx            │
│  += generated OpenUI system-prompt fragment  │   │   text part → splitOpenUiBlocks()       │
│     (agent/generated/genui-system-prompt.*)  │   │     prose  → <p> (as today)             │
│                                              │   │     openui → <AnalysisGenUi>            │
│ analyze_case tool (unchanged, deterministic) │   │                                         │
│  → dynamic-tool part output (zod-validated)  │   │ app/_components/genui/                  │
│                                              │   │   library.tsx  (defineComponent × N)    │
│ agent streams:                               │   │   renderer.tsx (<Renderer isStreaming>) │
│   prose … ```openui\nroot = …\n``` … prose   │   │   report-context.tsx (tool output ctx)  │
└──────────────────────────────────────────────┘   │   extract-openui.ts (fence parser)      │
                                                   │                                         │
     data NEVER travels through the LLM UI code —  │ Fallback: tool-results.tsx              │
     components resolve it from the tool output    │   AnalysisReport (unchanged)            │
     via ReportContext by reference only           └─────────────────────────────────────────┘
```

---

## 4. Dependencies

```bash
pnpm add @openuidev/react-lang @openuidev/lang-core
pnpm add -D @openuidev/cli
```

Verified compatibility (npm registry, 2026-07):

- `@openuidev/react-lang@0.2.8` — peers: `react ^18.3.1 || ^19.0.0` (app has 19.2.6 ✓),
  `zod ^3.25.0 || ^4.0.0` (app has 4.4.3 ✓), `@modelcontextprotocol/sdk >=1.0.0`.
- `@openuidev/lang-core@0.2.9` — same zod/MCP peers.
- If pnpm reports an unmet `@modelcontextprotocol/sdk` peer, add it as a devDependency
  at its latest 1.x. Do not silence the warning via `pnpm.peerDependencyRules`.
- Do NOT add `@openuidev/react-ui` — no built-in component library or CSS is used;
  all visuals come from the existing Tailwind design tokens.

---

## 5. Implementation Steps

### Phase 0 — Verification spike (throwaway, ~30 min)

1. `pnpm add` the packages above; confirm install is clean.
2. In a scratch Vitest file, run `createParser(library.toJSONSchema(), "Report").parse(...)`
   on a canned OpenUI Lang string and assert `result.meta.errors` is empty
   (note: errors live in `result.meta.errors`, not a top-level `errors` field).
3. Confirm `pnpm build` (`eve build && next build`) still passes with the packages
   installed but unused. Abort and reassess if `eve build` chokes on the dependency graph.

### Phase 1 — Custom library + renderer (client)

Create `app/_components/genui/library.tsx` (client module, JSX allowed):

Components — all props schemas in zod (`import { z } from "zod"`; installed zod is 4.x).
**Key order matters**: required and distinctive props first (they become positional args
in OpenUI Lang).

Domain blocks (reference-only, **no data props**; each component pulls canonical data
from `ReportContext` and renders the existing JSX extracted from `tool-results.tsx`):

| Component | Props (zod) | Renders |
|-----------|-------------|---------|
| `Report` (root) | `children: refs` | wrapper `<article>` with existing CARD styles |
| `CaseSummary` | — | existing summary grid (`SummaryItem`s) |
| `PriorityBanner` | — | existing `PriorityBadge` + reason |
| `MissingInfo` | — | existing numbered list of `missingInfo` |
| `ActionItems` | — | existing numbered list of `actionItems` |
| `SimilarCases` | — | existing `SimilarCasesCard` (embedded mode) |
| `Guides` | — | existing `GuidesCard` (embedded mode) |
| `Experts` | — | existing `ExpertsCard` (embedded, keeps consultation button wiring) |
| `Escalation` | — | human-escalation / follow-up question block |
| `ReanalysisChanges` | — | resolvedUnknowns / newFacts diff block (reanalysis only) |

Generic primitives (LLM-authored content allowed — text only, never numbers/rankings):

| Component | Props | Purpose |
|-----------|-------|---------|
| `Section` | `title: string`, `children: refs` | headed section wrapper (existing `SectionTitle` styles) |
| `Stack` | `children: refs`, `gap?: "s"\|"m"\|"l"` | vertical layout |
| `Note` | `text: string`, `tone?: "info"\|"warn"` | short connective/explanatory sentence (Japanese) |

Export:

```ts
export const library = createLibrary({ root: "Report", components: [...] });
export const promptOptions = { /* CLI auto-detects an export named `promptOptions` */ };
```

Rules baked into components (constraint enforcement — the core safety property):

- Domain blocks read the parsed `AnalyzeCaseOutput` from `ReportContext` and render
  items in the tool's canonical order. The LLM therefore cannot reorder rankings,
  alter scores, or invent evidence — satisfying `product-scope.md`
  ("Search candidates and ranking are fixed in tool code").
- If the LLM references `ReanalysisChanges` on an initial analysis, the component
  renders nothing (context has `reanalysisChanges: null`).
- Deduplicate: if the same domain block is referenced twice, render only the first
  occurrence (track rendered blocks per message in the context provider).

Create `app/_components/genui/report-context.tsx`:

- `ReportProvider({ output: AnalyzeCaseOutput, callbacks, children })` — supplies the
  validated tool output plus the existing interaction callbacks
  (`onRequestConsultation`, `onFocusComposer`, `onAnnounce`) so `Experts` keeps its
  current behavior.

Create `app/_components/genui/renderer.tsx`:

```tsx
"use client";
import { Renderer } from "@openuidev/react-lang";
// <AnalysisGenUi response isStreaming output callbacks />
// wraps ReportProvider + <Renderer response={...} library={library}
//   isStreaming={isStreaming} onError={log} />
```

- During streaming, unresolved forward refs are expected — do not treat them as errors.
- `onError` after stream end triggers the fallback path (see Phase 2).

### Phase 2 — Fence extraction + chat integration

Create `app/_components/genui/extract-openui.ts` (pure, unit-testable):

```ts
type TextSegment =
  | { kind: "prose"; text: string }
  | { kind: "openui"; source: string; closed: boolean };
export function splitOpenUiBlocks(text: string): TextSegment[];
```

- Handles: no block; one complete block; an **unterminated** block at end of string
  (streaming in progress → `closed: false`); ignores non-`openui` fences.

Modify `app/_components/eve-chat.tsx` (message part rendering, currently ~line 499):

- For each assistant `text` part, run `splitOpenUiBlocks`.
  - `prose` segments → existing `<p>` rendering.
  - `openui` segments → `<AnalysisGenUi>` with:
    - `response` = block source,
    - `isStreaming` = block not closed **or** message still pending,
    - `output` = the `AnalyzeCaseOutput` parsed from the most recent preceding
      `dynamic-tool` part with `toolName === "analyze_case"` in the same message
      (reuse the `AnalyzeCaseOutputSchema.safeParse` already done in `ToolResult`;
      lift that parse into a shared helper to avoid duplicated logic).
  - Raw fenced source text must never be shown to the user.
- **Fallback logic (Decision 4):**
  - If a message contains a successful `analyze_case` tool part but, once the message
    completes, there is **no** openui block or the block fails to parse/render →
    render the existing `AnalysisReport` card exactly as today.
  - While streaming and before any openui block has appeared, keep current behavior
    (tool progress indicator) — the change is purely additive.
  - Persisted-thread replay: restored messages render through the same path with
    `isStreaming=false`; invalid openui source → fallback card. No persistence schema
    change (openui source lives inside already-persisted text parts).
- Suppress the default `ToolResult` card for `analyze_case` **only when** a valid
  openui rendering for that tool call is shown (avoid double-rendering the report).

### Phase 3 — Prompt generation pipeline (build-time, Decision 7)

1. Add a package script:

```jsonc
"genui:generate": "openui generate app/_components/genui/library.tsx --out agent/generated/genui-system-prompt.txt && openui generate app/_components/genui/library.tsx --json-schema --out shared/genui/component-spec.json"
```

   - The CLI resolves the `library` export (module with `prompt()` / `toJSONSchema()`),
     auto-detecting `promptOptions`.
   - Commit both generated files. Regenerate whenever `library.tsx` changes.
   - Do not wire it into `pnpm build` (keeps the mandated `eve build && next build`
     pipeline untouched); a Vitest freshness guard (Phase 4) fails when the committed
     prompt is stale.

2. Modify `agent/instructions.ts` (English, per language rules):

   - Load the generated fragment at module scope with `node:fs`
     `readFileSync(new URL("./generated/genui-system-prompt.txt", import.meta.url), "utf8")`
     (agent code is server-only). Verify `eve build` bundles/copies the txt — if not,
     switch to a committed `agent/generated/genui-system-prompt.ts` exporting a string
     constant (generated by a thin wrapper around the CLI output). Prefer the `.ts`
     constant if in doubt: zero bundler assumptions.
   - Append behavioral instructions, in English, covering:
     - After every successful `analyze_case` call, output exactly one fenced block
       labeled `openui` containing an OpenUI Lang program.
     - Put the `root = Report([...])` statement first (streaming requirement).
     - One statement per line; positional args only; double-quoted strings.
     - Use only the listed components. Domain blocks take no data arguments — never
       transcribe case data, scores, rankings, or evidence into the program.
     - All human-readable strings inside the program (Section titles, Note text)
       must be Japanese.
     - Adapt section order/emphasis to the case (e.g., lead with `PriorityBanner` and
       `Escalation` for high-priority cases; lead with `MissingInfo` when evidence is
       insufficient), but always include `CaseSummary`, `PriorityBanner`,
       `MissingInfo`, `ActionItems`, `SimilarCases`, `Guides`, `Experts` somewhere.
       Include `ReanalysisChanges` only for reanalysis.
     - Keep prose outside the block short; the block is the primary answer.
   - Keep the existing "call analyze_case before acknowledgement" rule intact.

3. Canonical example (goes into the prompt):

```text
root = Report([intro, prio, summary, missing, actions, evidence, experts, esc])
intro = Note("空き家の相続に関するご相談ですね。以下に初動分析をまとめます。", "info")
prio = PriorityBanner()
summary = CaseSummary()
missing = Section("不足している情報", [mi])
mi = MissingInfo()
actions = ActionItems()
evidence = Stack([sim, gui], "m")
sim = SimilarCases()
gui = Guides()
experts = Experts()
esc = Escalation()
```

### Phase 4 — Tests & quality gates

New Vitest suites under `tests/` (deterministic, no network):

1. `tests/app/extract-openui.test.ts` — fence splitting incl. streaming-partial case.
2. `tests/app/genui-library.test.ts` —
   - `createParser(library.toJSONSchema(), "Report")` parses the canonical example with
     `result.meta.errors ?? []` empty;
   - rejects unknown components / excess positional args (errors present).
3. `tests/app/genui-prompt-freshness.test.ts` — regenerating the prompt in-memory via
   `library.prompt(promptOptions)` equals the committed generated file
   (guards Decision 7 staleness). If the CLI output wraps/differs from
   `library.prompt()`, compare against whatever generation call the CLI makes;
   settle this once during implementation.
4. Fallback unit test: message fixture with `analyze_case` output but a missing/broken
   openui block selects the `AnalysisReport` path (test the selection function
   extracted from `eve-chat.tsx`, keeping tests deterministic).

Required gates before handoff/PR (repo rules — all must run):

```bash
pnpm genui:generate   # then verify no git diff in generated files
pnpm test
pnpm typecheck
pnpm build
npx react-doctor@latest --verbose --scope changed
```

Manual verification (dev server): send a sample case; observe report sections appearing
progressively during the stream; force a broken program once (temporary prompt tweak)
and confirm the fallback card renders.

### Phase 5 (optional, explicitly deferred)

- Extend OpenUI rendering to `draft_consultation_request` and the three standalone
  search cards.
- Error-correction loop: feed `Renderer` `onError` details back to the agent as a
  follow-up Eve input for regeneration.
- Remove the fixed `AnalysisReport` once the OpenUI path proves reliable.

---

## 6. Constraint Compliance Checklist

- **product-scope.md / REQUIREMENT §8/§10**: no new external services, no real data,
  web channel only. OpenUI here is a client rendering library + prompt fragment — ✓.
- **Ranking/evidence immutability**: enforced structurally by reference-only domain
  components (Decision 2); the LLM has no syntax to alter data — ✓.
- **Language rules**: library/prompt/instructions source in English; all user-visible
  strings (component labels, Note content, fallback text) in Japanese — ✓.
- **No lint/format tooling invented**; only the allowed commands above — ✓.
- **`Result`/`TaggedError` never serialized** into tool or API payloads — untouched — ✓.
- **PR convention**: Conventional Commits, lowercase subject, allowed scopes —
  e.g. `feat(app): stream analyze_case report via openui`.

## 7. Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| `eve build` fails to include the generated `.txt` | Committed `.ts` string-constant module instead (explicit fallback in Phase 3) |
| Model omits/malforms the openui block | Structural fallback to existing card (Decision 4); canonical example in prompt |
| `@openuidev` peer warning (`@modelcontextprotocol/sdk`) | Add as devDependency, latest 1.x |
| Prompt drift vs library | Freshness test (Phase 4 #3) fails CI |
| Double rendering (openui + fixed card) | Explicit suppression rule in eve-chat integration (Phase 2) |
| Raw ```openui text flashing during stream | `splitOpenUiBlocks` handles unterminated fences from the first chunk |
| a11y regressions | Domain blocks reuse existing accessible JSX; react-doctor in the gate |

## 8. Out of Scope

- `AgentInterface`, `@openuidev/react-ui`, OpenUI Cloud, `Query`/`Mutation`/reactive
  state (`$vars`), artifacts, theming.
- Any change to Eve channel auth, thread persistence schema, Elysia API, or DB.
- Rendering changes to the other four tool cards (Phase 5 only, not now).
