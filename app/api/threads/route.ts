import { createThreadBodySchema } from "@/server/schemas/threads";
import { getSessionUserId } from "@/server/utils/session";
import { createThreadForUser, listThreadsForUser } from "@/server/utils/threads";

function unauthorized() {
  return Response.json({ error: "Unauthorized" }, { status: 401 });
}

export async function GET(request: Request) {
  const userId = await getSessionUserId(request.headers);
  if (!userId) return unauthorized();

  const threads = await listThreadsForUser(userId);
  return Response.json({ threads });
}

export async function POST(request: Request) {
  const userId = await getSessionUserId(request.headers);
  if (!userId) return unauthorized();

  const payload = await request.json().catch(() => null);
  const parsed = createThreadBodySchema.safeParse(payload);
  if (!parsed.success) {
    return Response.json({ error: "Invalid request" }, { status: 400 });
  }

  const thread = await createThreadForUser(userId, parsed.data);
  return Response.json({ thread }, { status: 201 });
}
