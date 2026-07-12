import type { ThreadSummary } from "@/shared/types/thread";

export const authQueryKeys = {
  all: ["auth"] as const,
} as const satisfies {
  readonly all: readonly ["auth"];
};

export const threadQueryKeys = {
  all: ["threads"] as const,
  detail: (id: ThreadSummary["id"]) => ["threads", "detail", id] as const,
  lists: () => ["threads", "list"] as const,
} as const satisfies {
  readonly all: readonly ["threads"];
  readonly detail: (
    id: ThreadSummary["id"],
  ) => readonly ["threads", "detail", ThreadSummary["id"]];
  readonly lists: () => readonly ["threads", "list"];
};
