---
description: Elysia API boundaries, OpenAPI, application services, and Next.js integration
globs: ["server/api/**/*.ts", "server/application/**/*.ts", "app/api/v1/**/*.ts", "lib/api-client.ts"]
paths:
  - "server/api/**/*.ts"
  - "server/application/**/*.ts"
  - "app/api/v1/**/*.ts"
  - "lib/api-client.ts"
alwaysApply: false
---

# Elysia API

Follow the project-local `elysiajs` skill and current official Elysia documentation.

- Mount the versioned Elysia application through a Next.js App Router catch-all Route Handler.
- Keep controllers HTTP-specific and thin. Authentication, same-origin checks, content type/body limits, If-Match parsing, and status/header conversion belong in `server/api/`.
- Application services receive an authenticated user ID, plain DTOs, and an explicit expected revision. They must not accept `Request`, `Response`, or `Headers`, and their only infrastructure dependencies are repository interfaces.
- Build Elysia instances through method chaining so plugin, model, and context types are preserved.
- Declare plugin and decorated dependencies explicitly. Do not rely on lifecycle hooks leaking across instances.
- Use shared Zod schemas at request and response boundaries and map Zod 4 schemas into OpenAPI.
- Document every public operation, required request header, success response header, and expected error response. Keep the OpenAPI JSON endpoint build-verifiable with Zod-parsed contract tests.
- Return typed `better-result` values from application services for expected failures. Convert them to plain response bodies and HTTP statuses only in the controller.
- Server Components call the shared application service directly instead of making an HTTP request to the same deployment.
- Client Components use the typed Eden client or a small typed API adapter; do not embed ad hoc response assertions in TSX.
- Preserve Better Auth session checks, same-origin mutation checks, ownership checks, body limits, and no-store response headers.
- Test the public Elysia app with `app.handle(new Request(...))`; do not start a listener in tests or Next.js.
