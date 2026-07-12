---
description: better-result best practices for typed errors, composition, and serialization boundaries
globs: ["agent/**/*.ts", "server/**/*.ts", "app/api/**/*.ts", "evals/**/*.ts"]
paths:
  - "agent/**/*.ts"
  - "server/**/*.ts"
  - "app/api/**/*.ts"
  - "evals/**/*.ts"
alwaysApply: true
---

# better-result Best Practices

Follow the [official better-result best practices](https://better-result.dev/advanced/best-practices) when introducing or changing Result-based code.

## Use Result at expected-failure boundaries

- Use `Result` for expected business or integration failures such as validation, not found, auth, API, parsing, and I/O failures.
- Wrap throwing third-party calls, including database queries, `fetch`, SDK calls, and connection clients, at the boundary with `Result.try` or `Result.tryPromise`.
- Keep truly exceptional programmer defects as throws or framework control flow. Do not convert every throw blindly.

```typescript
const result = await Result.tryPromise({
  try: () => fetchForecast(city),
  catch: (cause) => new ApiError({
    cause,
    message: "forecast API call failed",
  }),
});
```

## Prefer typed, discriminated errors

- Use `TaggedError` for domain or infrastructure errors that cross function boundaries.
- Keep useful context on errors: `message`, `cause`, ids, status, operation, reason, and retryability when relevant.
- Use `matchError` when the error union has multiple tagged variants and exhaustive handling matters.
- Avoid `Result<T, any>`.

```typescript
class AuthError extends TaggedError("AuthError")<{
  cause?: unknown;
  message: string;
  reason: "expired" | "invalid" | "missing";
}>() {}
```

## Compose without premature unwrapping

- Use `Result.gen` for multi-step flows so failures short-circuit naturally.
- In async generators, yield promise results with `yield* Result.await(...)`.
- Keep values inside the Result context until the boundary where a plain response is required.
- Use `Result.isError` / `Result.isOk` type guards or `.match(...)`; both are valid. Do not require `.match(...)` when a type guard is clearer.

```typescript
const result = await Result.gen(async function* () {
  const user = yield* Result.await(fetchUser(id));
  const session = yield* createSession(user);
  return Result.ok(session);
});
```

## Do not leak Result over serialization boundaries

- A tool's `execute` return value, an Elysia controller response, a channel response, and anything the model or a serializer consumes must be plain serializable data.
- Never serialize `Ok`, `Err`, `TaggedError`, `Error`, `Response`, or other class instances.
- Unwrap the Result at the boundary and return a plain object.
- Let TypeScript infer public return types unless inference becomes `unknown` / `any` or the function is an explicit public API boundary.

```typescript
if (Result.isError(result)) {
  return { ok: false as const, message: result.error.message };
}

return { ok: true as const, forecast: result.value };
```

## Avoid anti-patterns

- Do not call `.unwrap()` unless the result has already been checked or the throw is intentional and documented.
- Do not mix Result-returning expected failures with ordinary throws in the same domain flow.
- Do not ignore Result errors. Handle, propagate, or log them intentionally.
- Do not add Result wrappers inside tight loops when parsing or validation can be done first and wrapped once at the boundary.

## Testing

- Cover success and error paths for Result-returning code.
- In unit-style helper tests, use `Result.isError` / `Result.isOk` to narrow before asserting variant-specific fields.
- For agent behavior, assert the plain boundary outcome because evals cannot observe internal Result wrappers.

