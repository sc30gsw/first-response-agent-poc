import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const agentDir = fileURLToPath(new URL("./agent", import.meta.url));

// Resolve the package.json `#*` subpath imports (`#lib/...` -> `agent/lib/...`)
// so tests and domain modules share the same alias as the runtime agent.
export default defineConfig({
  resolve: {
    alias: [{ find: /^#(.+)$/, replacement: `${agentDir}/$1` }],
  },
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node",
  },
});
