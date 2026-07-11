---
description: Valibot schemas at eve boundaries — tool inputs, channel payloads, external responses
globs: ["agent/**/*.ts"]
alwaysApply: true
---

# Valibot Validation

`valibot` is the validation library for this agent. Valibot schemas are Standard Schema compliant, so they work as tool parameter schemas and in eval `matches(schema)` checks.

## Placement: at the boundary, near what it guards

There is no `features/*/schemas/` here. Co-locate a schema with the boundary it validates, and lift shared schemas into `agent/lib/`:

```
agent/
├── tools/get_weather.ts     # input schema lives with the tool
├── channels/eve.ts          # validate the inbound payload here
└── lib/schemas/             # schemas shared across tools/channels/connections
```

## Derive types with `InferOutput`

Define the schema once and derive the type from it — single source of truth:

```typescript
import * as v from "valibot";

export const GetWeatherInput = v.object({
  city: v.pipe(v.string(), v.minLength(1, "city is required")),
  units: v.optional(v.picklist(["c", "f"]), "c"),
});

export type GetWeatherInput = v.InferOutput<typeof GetWeatherInput>;
```

## Boundaries only

Validate at system boundaries — tool inputs, channel payloads, and external API / connection responses. Do NOT add Valibot validation to pure internal data transformations between trusted functions.

```typescript
// CORRECT: validate untrusted external data before use
const parsed = v.safeParse(GetWeatherInput, rawArgs);
if (!parsed.success) throw new ValidationError(parsed.issues);

// WRONG: trusting an unvalidated external response
const data = apiResponse as WeatherData;
```

## Related rules

- [common/security.md](../common/security.md) — why boundary validation matters
- [typescript/better-result.md](./better-result.md) — wrap parse/validation failures as typed Results
