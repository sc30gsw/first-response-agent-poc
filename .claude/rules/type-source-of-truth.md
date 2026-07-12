---
description: Type source-of-truth ownership across Drizzle, Zod, SDK, application, and UI boundaries
globs: ["agent/**/*.ts", "app/**/*.ts", "app/**/*.tsx", "lib/**/*.ts", "server/**/*.ts", "shared/**/*.ts"]
alwaysApply: true
---

# Type Source of Truth

- Derive database rows and inserts from Drizzle `$inferSelect` / `$inferInsert`.
- Derive database-owned IDs and revisions through indexed access; do not repeat them as handwritten primitives.
- Use `Pick`, `Omit`, `Partial`, `Required`, `Parameters`, `ReturnType`, and `Awaited` to derive related types.
- Use `z.input` for untrusted schema input and `z.output` for validated values.
- Do not type raw route parameters or network data as validated database values before parsing.
- Keep DTOs separate from rows when names or representations change. Derive unchanged scalar fields and use one explicit mapper for renamed, timestamp, or JSON transformations.
- A shared wire contract may use an erased `import type` for unchanged Drizzle scalars, but must never import table values or database runtime code.
- Propagate corrupt persisted JSON as typed `Result` errors; never reinterpret corruption as missing data.
- Derive framework callback and adapter types from the owning SDK. Keep semantically different IDs separate even when they are strings.
- Use `as const satisfies` for fixed maps and enumerated arrays.
