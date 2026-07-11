import { Result } from "better-result";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { NotFoundError } from "@/server/application/thread-errors";
import { threadApplicationService } from "@/server/application/thread-service";
import { EveChat } from "../../_components/eve-chat";

type ChatPageProps = {
  readonly params: Promise<{ readonly id: string }>;
};

export default async function ChatPage({ params }: ChatPageProps) {
  const [requestHeaders, { id }] = await Promise.all([headers(), params]);
  const session = await auth.api.getSession({ headers: requestHeaders });
  if (!session?.user?.id) redirect("/");

  const [threadResult, listResult] = await Promise.all([
    threadApplicationService.get(session.user.id, id),
    threadApplicationService.list(session.user.id),
  ]);
  if (Result.isError(threadResult)) {
    if (NotFoundError.is(threadResult.error)) notFound();
    console.error("Failed to load the thread", {
      operation: threadResult.error.operation,
      tag: threadResult.error._tag,
    });
    throw new Error("The thread could not be loaded");
  }
  if (Result.isError(listResult)) {
    console.error("Failed to load the thread list", {
      operation: listResult.error.operation,
      tag: listResult.error._tag,
    });
    throw new Error("The thread list could not be loaded");
  }

  return (
    <EveChat
      key={threadResult.value.thread.id}
      thread={threadResult.value.thread}
      threads={listResult.value.threads}
    />
  );
}
