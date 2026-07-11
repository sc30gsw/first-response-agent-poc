import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { getThreadForUser, listThreadsForUser } from "@/server/utils/threads";
import { EveChat } from "../../_components/eve-chat";

type ChatPageProps = {
  readonly params: Promise<{ readonly id: string }>;
};

export default async function ChatPage({ params }: ChatPageProps) {
  const [requestHeaders, { id }] = await Promise.all([headers(), params]);
  const session = await auth.api.getSession({ headers: requestHeaders });
  if (!session?.user?.id) redirect("/");

  const [thread, threads] = await Promise.all([
    getThreadForUser(session.user.id, id),
    listThreadsForUser(session.user.id),
  ]);
  if (!thread) notFound();

  return <EveChat key={thread.id} thread={thread} threads={threads} />;
}
