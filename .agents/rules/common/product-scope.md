---
description: PoC product scope, language, safety, and prohibited legacy capabilities
globs: []
alwaysApply: true
---

# Product Scope

`REQUIREMENT.md` is the product source of truth. Resolve conflicts in its favor.

## In scope

- web chat and anonymous demo authentication
- structured case analysis and missing-information extraction
- deterministic search over dummy JSON cases, guides, and experts
- evidence display, reanalysis, and consultation-request drafting
- Next.js App Router/React UI, Eve agent, Better Auth, Drizzle/libsql (Turso on Vercel), Vitest, and Vercel deployment

## Out of scope

Do not add or reactivate real data connections, Slack, iMessage, GitHub, Linear, Vercel Connect, outbound messaging, schedules, multiple agents, long-term memory, profiles, automatic PII masking, valuation, or legal and tax decisions.

Keep model-accessible shell, filesystem, search/fetch, Todo, schedule, external-service, and subagent tools explicitly disabled.

## Language

- Write Eve instruction and skill source files in English.
- Write user-facing UI, dummy data, and agent responses in Japanese.
- Keep established technical names and identifiers in their original language.

Never present AI output as a final professional decision. Separate AI-organized information from items requiring human or specialist confirmation.
