import { patchThreadBodySchema, threadIdParamsSchema } from "@/server/schemas/threads";
import { getSessionUserId } from "@/server/utils/session";
import {
  deleteThreadForUser,
  getThreadForUser,
  updateThreadForUser,
} from "@/server/utils/threads";

type RouteContext = {
  readonly params: Promise<{ readonly id: string }>;
};

function unauthorized() {
  return Response.json({ error: "Unauthorized" }, { status: 401 });
}

async function requestContext(request: Request, context: RouteContext) {
  const userId = await getSessionUserId(request.headers);
  if (!userId) return { error: unauthorized() } as const;

  const parsed = threadIdParamsSchema.safeParse(await context.params);
  if (!parsed.success) {
    return {
      error: Response.json({ error: "Invalid thread ID" }, { status: 400 }),
    } as const;
  }

  return { id: parsed.data.id, userId } as const;
}

export async function GET(request: Request, context: RouteContext) {
  const authContext = await requestContext(request, context);
  if ("error" in authContext) return authContext.error;

  const thread = await getThreadForUser(authContext.userId, authContext.id);
  if (!thread) {
    return Response.json({ error: "Thread not found" }, { status: 404 });
  }

  return Response.json({ thread });
}

export async function PATCH(request: Request, context: RouteContext) {
  const authContext = await requestContext(request, context);
  if ("error" in authContext) return authContext.error;

  const payload = await request.json().catch(() => null);
  const parsed = patchThreadBodySchema.safeParse(payload);
  if (!parsed.success) {
    return Response.json({ error: "Invalid request" }, { status: 400 });
  }

  const thread = await updateThreadForUser(authContext.userId, authContext.id, parsed.data);
  if (!thread) {
    return Response.json({ error: "Thread not found" }, { status: 404 });
  }

  return Response.json({ thread });
}

export async function DELETE(request: Request, context: RouteContext) {
  const authContext = await requestContext(request, context);
  if ("error" in authContext) return authContext.error;

  const deleted = await deleteThreadForUser(authContext.userId, authContext.id);
  if (!deleted) {
    return Response.json({ error: "Thread not found" }, { status: 404 });
  }

  return Response.json({ ok: true });
}
