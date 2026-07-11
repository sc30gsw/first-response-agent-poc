---
description: Eve authored-slot, tool, web-channel, instruction, and serialization rules
globs: ["agent/**/*"]
paths:
  - "agent/**/*"
alwaysApply: false
---

# Eve

Before changing Eve-authored code, read the relevant documentation shipped under `node_modules/eve/dist/docs/public/`. If dependencies are absent, install them before relying on package APIs. If the path differs in the installed version, locate the packaged docs rather than guessing.

## Authored code

- Keep `agent/agent.ts` focused on runtime configuration and default-export `defineAgent(...)`.
- Default-export authored channels and tools as required by Eve.
- Put one tool in each `agent/tools/<tool_name>.ts` file.
- Use snake_case ASCII tool filenames because the filename is model-visible identity.
- Put shared agent-only logic in `agent/lib/` and use named exports there.
- Write authored instructions and skills in English and require Japanese user-facing output.

## Product tools

- Define Zod schemas for tool inputs and structured outputs.
- Keep search candidates and ranking deterministic in tool code.
- Return plain serializable data from `execute`.
- Do not return `Result`, `Error`, `Response`, database handles, or class instances to the model.
- Do not expose secrets, internal stack traces, or sensitive input in tool results.

## Channel and capabilities

The web channel is the only supported channel. Derive the caller from verified authentication, not a body-supplied identity.

Keep shell, filesystem, arbitrary web search/fetch, Todo, schedules, subagents, and external connections explicitly disabled. Do not add Slack or iMessage channels.
