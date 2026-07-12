---
description: TanStack Query rules for browser-side API synchronization
globs: ["app/**/*.tsx", "lib/api-client.ts"]
paths:
  - "app/**/*.tsx"
  - "lib/api-client.ts"
alwaysApply: false
---

# TanStack Query

- Use TanStack Query for browser-side reads and mutations that call the application API.
- Use the typed Eden adapter in `lib/api-client.ts`; do not call thread endpoints with ad hoc `fetch` or cast JSON inside TSX.
- Keep a stable `QueryClient` in a Client Component provider.
- Server Components call Application Services directly and must not fetch the same deployment's HTTP API.
- Use mutation scopes when writes for the same resource must execute serially.
- Retry only failures explicitly marked retryable, with bounded attempts and delay.
- Surface user-facing errors in Japanese and never expose raw infrastructure error details.
- Invalidate or refresh the smallest affected data boundary after successful mutations.

