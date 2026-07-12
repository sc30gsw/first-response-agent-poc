import { ClientError } from "eve/client";
import { z } from "zod";

const EveRateLimitBodySchema = z.object({
  code: z.enum(["concurrent_turn_limit", "rate_limit_exceeded"]),
  retryAfter: z.number().int().positive().optional(),
});

const CONCURRENT_TURN_MESSAGE =
  "PoCでは同時に1件のみ分析できます。前の分析がまだ実行中、または終了処理中です。画面上部が「待機中」になってから、少し待って再度お試しください。";

function formatRetryAfter(seconds: number | undefined) {
  if (seconds === undefined) return "時間をおいて";
  if (seconds < 60) return `${seconds}秒ほど待って`;
  if (seconds < 3_600) return `${Math.ceil(seconds / 60)}分ほど待って`;
  return `${Math.ceil(seconds / 3_600)}時間ほど待って`;
}

export function eveErrorMessage(error: unknown, fallback: string) {
  if (!(error instanceof ClientError) || error.status !== 429) return fallback;

  const parsedBody = z.string().transform((body, context) => {
    try {
      return JSON.parse(body) as unknown;
    }
    catch {
      context.addIssue({ code: "custom", message: "Invalid JSON" });
      return z.NEVER;
    }
  }).pipe(EveRateLimitBodySchema).safeParse(error.body);

  if (!parsedBody.success) return fallback;
  return parsedBody.data.code === "concurrent_turn_limit"
    ? CONCURRENT_TURN_MESSAGE
    : `PoCの送信上限に達しました。${formatRetryAfter(parsedBody.data.retryAfter)}から再度お試しください。`;
}
