---
description: eve trust boundaries, secrets in process.env, channel auth, boundary validation
globs: ["agent/**/*.ts"]
alwaysApply: true
---

# Security

Reference: `node_modules/eve/docs/concepts/security-model.md`.

## Trust boundary: app runtime vs sandbox

Your agent runs across two contexts. Keep every secret on the trusted side.

| | App runtime (trusted) | Sandbox (isolated) |
| --- | --- | --- |
| `process.env` / secrets | Yes | **No** |
| Your Node.js code (tools, channels, connections) | Yes | No |
| Filesystem | App's own | Isolated `/workspace` |

Tool `execute` runs in the app runtime, reads secrets, calls the service, and returns a result. The model sees only the returned value — never the credential.

## Secrets

NEVER hardcode secrets. Read them from `process.env` in the app runtime (this is a Node server, **not** a browser bundle — there is no `import.meta.env` / `VITE_` prefix here). Fail fast when a required var is missing.

```typescript
// CORRECT: read from process.env at use, fail fast
const apiKey = process.env.STRIPE_KEY;
if (!apiKey) throw new Error("STRIPE_KEY is required");

// WRONG: hardcoded secret
const apiKey = "sk-abc123...";

// WRONG: never pass a secret into the sandbox or compiled artifacts
```

Route privileged calls through tools or connections; scope connection tokens to least privilege.

## Channel auth fails closed

Routes reject unauthenticated traffic by default (`401`). Before exposing the agent:

- Replace `placeholderAuth()` in `agent/channels/eve.ts` with a real `AuthFn` (`vercelOidc()`, `oidc()`, `httpBasic()`, …).
- Verify channel signatures with a **constant-time** compare — never `===` on a signature.
- Derive the caller from a verified signature/token, **never** from a body-supplied `principalId`.

## Input validation at boundaries

Validate untrusted input at system boundaries (channel payloads, tool inputs, external API responses) with Valibot. See [typescript/valibot-validation.md](../typescript/valibot-validation.md).

```typescript
import * as v from "valibot";

const parsed = v.safeParse(PayloadSchema, rawBody);
if (!parsed.success) throw new ValidationError(parsed.issues);

// WRONG: trusting unvalidated external data
const payload = rawBody as Payload;
```

## Untrusted text is data, not markup

Model- or user-controlled strings rendered into a channel UI must be escaped for that surface. Treat skill/schedule markdown frontmatter strictly as data (code-capable frontmatter engines are disabled).
