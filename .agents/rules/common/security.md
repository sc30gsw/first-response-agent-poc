---
description: Authentication, secrets, PII, model tools, and validation boundaries
globs: ["agent/**/*.ts", "app/**/*.{ts,vue}", "server/**/*.ts", "shared/**/*.ts"]
paths:
  - "agent/**/*.ts"
  - "app/**/*.ts"
  - "app/**/*.vue"
  - "server/**/*.ts"
  - "shared/**/*.ts"
alwaysApply: true
---

# Security

`REQUIREMENT.md` is the authority for PoC security and safety scope.

## Secrets and trusted code

- Never hardcode or commit API keys, authentication secrets, or database tokens.
- Access secrets only in trusted server or Eve runtime code through Nuxt `runtimeConfig` or `process.env` as appropriate.
- Never expose secrets through `runtimeConfig.public`, client code, logs, prompts, model-visible tool results, dummy data, or documentation examples.
- Fail clearly when required server configuration is missing without printing the secret.

## Authentication and authorization

- Fail closed: unauthenticated or unauthorized requests must not receive protected data.
- Derive identity from a verified Better Auth session or verified Eve channel token.
- Never trust a body-, parameter-, or query-supplied user ID for ownership.
- Scope database reads and writes to the authenticated user in server-side code.

## Boundary validation

Validate untrusted tool inputs, HTTP inputs, dummy JSON, and allowed external responses with Zod. Do not replace validation with a TypeScript assertion. Parse once at the boundary and pass typed values inward.

## PoC data and model safety

- Use only fictional cases and fictional employees or experts.
- Keep real customer and employee data out of the repository and demos.
- Preserve the UI notice that users must not enter personal information.
- Do not claim automatic PII detection, blocking, or masking.
- Treat model- and user-controlled text as untrusted when rendering it.
- Do not expose arbitrary shell, filesystem, web, Todo, schedule, subagent, or external-service capabilities to the model.
- Do not let the model make final legal, tax, valuation, or contract decisions.
