import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { anonymous } from "better-auth/plugins";
import { eq } from "drizzle-orm";
import type { LibSQLDatabase } from "drizzle-orm/libsql";
import { threads } from "../db/schema/threads";

/** 匿名セッションの有効期間（秒）: 24時間で失効させる */
const SESSION_TTL_SECONDS = 60 * 60 * 24;

type CreateAuthOptions<TSchema extends Record<string, unknown>> = {
  db: LibSQLDatabase<TSchema>;
  schema: Record<string, unknown>;
  baseURL?: string;
  secret?: string;
  trustedOrigins?: string[];
  /** メール/パスワード認証を許可するか。PoCは匿名のみを既定とする */
  allowEmailPassword?: boolean;
};

/**
 * better-authインスタンスのファクトリ。
 * 実行環境（@nuxthub/db）とテスト（インメモリlibsql）で同一構成を共有する。
 */
export function createAuth<TSchema extends Record<string, unknown>>(
  options: CreateAuthOptions<TSchema>,
) {
  const { db } = options;

  return betterAuth({
    baseURL: options.baseURL,
    secret: options.secret,
    trustedOrigins: options.trustedOrigins,
    database: drizzleAdapter(db, {
      provider: "sqlite",
      schema: options.schema,
    }),
    emailAndPassword: {
      enabled: options.allowEmailPassword ?? false,
    },
    plugins: [anonymous()],
    session: {
      expiresIn: SESSION_TTL_SECONDS,
    },
    rateLimit: {
      // 既定ではproductionのみ有効のため、全環境で明示的に有効化する
      enabled: true,
      storage: "memory",
    },
    databaseHooks: {
      user: {
        delete: {
          before: async (user) => {
            // FK cascadeに依存せず、匿名ユーザー削除時に関連スレッドを確実に消す
            await db.delete(threads).where(eq(threads.userId, user.id));
          },
        },
      },
    },
  });
}
