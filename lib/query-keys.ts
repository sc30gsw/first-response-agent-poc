export const authQueryKeys = {
  all: ["auth"] as const,
} as const satisfies {
  readonly all: readonly ["auth"];
};

export const threadQueryKeys = {
  all: ["threads"] as const,
  detail: (id: string) => ["threads", "detail", id] as const,
  lists: () => ["threads", "list"] as const,
} as const satisfies {
  readonly all: readonly ["threads"];
  readonly detail: (id: string) => readonly ["threads", "detail", string];
  readonly lists: () => readonly ["threads", "list"];
};
