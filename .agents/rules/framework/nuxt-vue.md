---
description: Nuxt 4, Vue 3, Nitro API, runtime configuration, and accessibility conventions
globs: ["app/**/*.{ts,vue}", "server/**/*.ts", "nuxt.config.ts"]
paths:
  - "app/**/*.ts"
  - "app/**/*.vue"
  - "server/**/*.ts"
  - "nuxt.config.ts"
alwaysApply: false
---

# Nuxt and Vue

- Use Vue 3 Composition API with `<script setup lang="ts">` for Vue SFCs.
- Follow Nuxt file-based routing, auto-import, and server conventions already used in the repository.
- Use `~/` for app-owned imports, `~~/` for root imports, and `#shared/` for shared contracts.
- Keep server-only dependencies, database access, and secrets out of client code.
- Expose only intentionally public configuration through `runtimeConfig.public`.

Keep Nitro handlers thin: authenticate, validate with Zod, call server/domain logic, and map the result to an HTTP response. Never trust client-supplied ownership fields.

Preserve `REQUIREMENT.md` accessibility requirements: semantic HTML, keyboard access, visible focus, meaningful labels, sufficient contrast, and announcements for dynamic state where needed.

User-facing UI is Japanese. Do not restore legacy template branding, channels, settings, memory, profile, or integrations that are outside PoC scope.
