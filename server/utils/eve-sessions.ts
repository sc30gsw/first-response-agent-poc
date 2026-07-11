import { and, eq, isNull } from "drizzle-orm";
import { db, type AppDatabase } from "../db/client";
import { eveSessionBindings } from "../db/schema/security";

type EveSessionDatabase = Pick<AppDatabase, "update">;

function revocationTimestamp() {
  return new Date();
}

export async function revokeEveSessionsForThread(
  userId: string,
  threadId: string,
  database: EveSessionDatabase = db,
) {
  const timestamp = revocationTimestamp();
  await database.update(eveSessionBindings)
    .set({ revokedAt: timestamp, purgeRequestedAt: timestamp })
    .where(and(
      eq(eveSessionBindings.userId, userId),
      eq(eveSessionBindings.threadId, threadId),
      isNull(eveSessionBindings.revokedAt),
    ));
}

export async function revokeEveSessionsForUser(
  userId: string,
  database: EveSessionDatabase = db,
) {
  const timestamp = revocationTimestamp();
  await database.update(eveSessionBindings)
    .set({ revokedAt: timestamp, purgeRequestedAt: timestamp })
    .where(and(
      eq(eveSessionBindings.userId, userId),
      isNull(eveSessionBindings.revokedAt),
    ));
}
