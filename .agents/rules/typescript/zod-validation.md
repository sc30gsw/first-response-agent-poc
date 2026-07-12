---
description: Zod schemas for Eve tools, HTTP boundaries, and dummy JSON data
globs: ["agent/**/*.ts", "server/**/*.ts", "shared/**/*.ts", "tests/**/*.test.ts"]
paths:
  - "agent/**/*.ts"
  - "server/**/*.ts"
  - "shared/**/*.ts"
  - "tests/**/*.test.ts"
alwaysApply: true
---

# Zod Validation

Zod is the single schema library for product code. Do not introduce Valibot for application schemas.

## Schema ownership

Place a schema close to the boundary it protects:

- Eve tool schemas in the tool or a cohesive `agent/lib/` schema module
- HTTP body and parameter schemas under `server/schemas/` or beside a single-use boundary
- dummy dataset schemas in the domain module that loads the JSON
- cross-layer schemas in `shared/` only when multiple layers actually parse the same contract

Define the schema once and derive the output type:

```typescript
import { z } from "zod";

export const CaseQuerySchema = z.object({
  summary: z.string().trim().min(1),
});

export type CaseQuery = z.infer<typeof CaseQuerySchema>;
```

## Boundaries

Validate Eve tool input and structured output, HTTP input, all dummy JSON records at module load, and external responses if a permitted integration is introduced.

Reject invalid data explicitly. Never silently filter invalid dummy records. Check duplicate case, guide, and expert IDs.

Do not repeatedly parse trusted internal values. Parse at the boundary, then use the inferred type.
