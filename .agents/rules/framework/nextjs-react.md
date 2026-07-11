---
description: Next.js App Router, React Server/Client Components, route handlers, and accessibility conventions
globs: ["app/**/*.{ts,tsx}", "next.config.ts"]
paths:
  - "app/**/*.ts"
  - "app/**/*.tsx"
  - "next.config.ts"
alwaysApply: false
---

# Next.js and React

- Use the App Router: pages in `app/**/page.tsx`, shared UI in `app/_components/`, APIs in `app/api/**/route.ts`.
- Server Components are the default. Add `"use client"` only to components that need state, event handlers, or browser APIs, and push client boundaries to the leaves of the tree.
- Keep server-only dependencies, database access, and secrets out of client components and the client bundle. Read secrets from `process.env` in server-only code; expose only intentionally public values as `NEXT_PUBLIC_*`.
- Use `@/*` for repository-root imports and `#lib/*` for `agent/lib/*`.
- Minimize props serialized from Server Components to Client Components.

Keep route handlers thin: authenticate, validate with Zod, call server/domain logic, and map the result to an HTTP response. Never trust client-supplied ownership fields.

## Performance

Follow `.claude/skills/vercel-react-best-practices/` (SKILL.md and rules/). Highest-impact rules for this PoC:

- Parallelize independent async work with `Promise.all`; move `await` into the branch that uses it (avoid waterfalls).
- Import modules directly instead of through barrel files.
- Load heavy client-only components with `next/dynamic`.
- Derive state during render; do not mirror props or derived values into state with effects.
- Do not define components inside other components.
- Use ternaries, not `&&`, for conditional rendering.

## Accessibility and language

Preserve `REQUIREMENT.md` accessibility requirements: semantic HTML, keyboard access, visible focus, meaningful labels, sufficient contrast, and announcements for dynamic state where needed.

User-facing UI is Japanese. Do not restore legacy template branding, channels, settings, memory, profile, or integrations that are outside PoC scope.
