import { headers } from "next/headers";
import { auth } from "@/auth";
import { Landing } from "./_components/landing";
import { WorkspaceHome } from "./_components/workspace-home";
import { listThreadsForUser } from "@/server/utils/threads";

export default async function HomePage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) return <Landing />;

  const threads = await listThreadsForUser(session.user.id);
  return <WorkspaceHome threads={threads} />;
}
