---
description: Type source-of-truth ownership across Drizzle, Zod, SDK, application, and UI boundaries
globs: ["agent/**/*.ts", "app/**/*.ts", "app/**/*.tsx", "lib/**/*.ts", "server/**/*.ts", "shared/**/*.ts"]
paths:
  - "agent/**/*.ts"
  - "app/**/*.ts"
  - "app/**/*.tsx"
  - "lib/**/*.ts"
  - "server/**/*.ts"
  - "shared/**/*.ts"
alwaysApply: true
---

# Type Source of Truth

Choose the source of truth by ownership; do not create one global `Id = string` or force unlike boundaries into one shape.

## Persistence

- Derive database row and insert types from the Drizzle table: `typeof table.$inferSelect` and `typeof table.$inferInsert`.
- Derive database-owned scalar arguments with indexed access such as `Thread["id"]`, `User["id"]`, and `Thread["stateVersion"]`.
- Build narrower storage inputs with `Pick`, `Omit`, `Partial`, and `Required`; do not repeat a table row as a handwritten object type.
- Export an inferred row alias from the schema module when more than one consumer needs it. Do not export unused aliases only for symmetry.

## Validation and serialization boundaries

- Zod is the source of truth for untrusted HTTP, persisted JSON, dummy JSON, and tool input/output shapes. Use `z.input<typeof schema>` before parsing and `z.output<typeof schema>` after parsing.
- Keep raw route parameters and network payloads untrusted until the owning schema validates them. Do not type a raw URL parameter as a validated database ID.
- A wire DTO is not a database row when fields are renamed or serialized differently. Derive only unchanged scalar fields with utility types, replace transformed fields explicitly, and keep one mapper at the boundary.
- Cross-layer contracts may use erased `import type` references to Drizzle row aliases for those unchanged scalars; they must not import table values or database runtime code.
- Validate JSON stored in text columns. Propagate parse/shape failures as typed `Result` errors; never convert corrupt data into an ordinary missing value.

## Framework and SDK contracts

- Derive adapter arguments and results from the owning SDK or factory with `Parameters`, `ReturnType`, and `Awaited` where practical.
- Use SDK-exported types for framework identifiers and callbacks. Keep semantically different IDs separate even when each is currently a string.
- Use `as const satisfies` for fixed maps and enumerated arrays; use `satisfies` to check runtime schemas or adapters without widening their inferred type.

## Tests

- Add compile-time assertions for critical storage-to-DTO scalar mappings.
- Test explicit mapper behavior for renamed/serialized fields and both success and corrupt-data paths.
