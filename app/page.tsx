import { Result } from "better-result";
import { headers } from "next/headers";
import { auth } from "@/auth";
import { threadApplicationService } from "@/server/application/thread-service";
import { Landing } from "./_components/landing";
import { WorkspaceHome } from "./_components/workspace-home";

export default async function HomePage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) return <Landing />;

  const result = await threadApplicationService.list(session.user.id);
  if (Result.isError(result)) {
    console.error("Failed to load the thread list", {
      operation: result.error.operation,
      tag: result.error._tag,
    });
    throw new Error("The thread list could not be loaded");
  }

  return <WorkspaceHome threads={result.value.threads} />;
}
