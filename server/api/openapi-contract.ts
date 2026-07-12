import { z } from "zod";

const responseSchema = z.looseObject({
  headers: z.record(z.string(), z.unknown()).optional(),
});

const operationSchema = z.looseObject({
  responses: z.record(z.string(), responseSchema).optional(),
});

const documentSchema = z.looseObject({
  paths: z.record(
    z.string(),
    z.record(z.string(), operationSchema),
  ),
});

const etagHeader = {
  description: "Quoted thread revision used with If-Match.",
  schema: {
    example: "\"2\"",
    type: "string",
  },
} as const satisfies {
  readonly description: string;
  readonly schema: {
    readonly example: string;
    readonly type: "string";
  };
};

const etagResponses = [
  { method: "post", path: "/api/v1/threads", status: "201" },
  { method: "get", path: "/api/v1/threads/{id}", status: "200" },
  { method: "patch", path: "/api/v1/threads/{id}", status: "200" },
] as const satisfies readonly {
  readonly method: "get" | "patch" | "post";
  readonly path: string;
  readonly status: "200" | "201";
}[];

/**
 * @elysiajs/openapi 1.4 does not preserve response-header annotations on
 * Standard Schema responses. Patch only the generated thread operations until
 * the plugin exposes Zod-compatible response-header metadata.
 */
export function addThreadEtagResponseHeaders(document: unknown): unknown {
  const parsed = documentSchema.safeParse(document);
  if (!parsed.success) return document;

  for (const target of etagResponses) {
    const response = parsed.data.paths[target.path]
      ?.[target.method]
      ?.responses
      ?.[target.status];
    if (!response) continue;
    response.headers = {
      ...response.headers,
      ETag: etagHeader,
    };
  }

  return parsed.data;
}
