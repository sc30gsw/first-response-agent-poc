import { auth } from "@/auth";
import type { User } from "../db/schema/auth";

export async function getSessionUserId(headers: Headers): Promise<User["id"] | null> {
  const session = await auth.api.getSession({
    headers,
  });

  return session?.user?.id ?? null;
}
