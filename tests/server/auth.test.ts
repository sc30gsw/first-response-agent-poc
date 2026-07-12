import { fileURLToPath } from "node:url";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import * as authSchema from "../../server/db/schema/auth";
import * as securitySchema from "../../server/db/schema/security";
import * as threadsSchema from "../../server/db/schema/threads";
import { createAuth } from "../../server/utils/create-auth";

const schema = {
  ...authSchema,
  ...securitySchema,
  ...threadsSchema,
};

const MIGRATIONS_FOLDER = fileURLToPath(
  new URL("../../server/db/migrations/sqlite", import.meta.url),
);

const BASE_URL = "http://localhost:3000";
const HOUR_MS = 60 * 60 * 1000;
const AnonymousSignInResponseSchema = z.object({
  token: z.string().min(1),
  user: z.object({
    id: z.string().min(1),
    isAnonymous: z.boolean(),
  }),
});
const SessionResponseSchema = z.object({
  user: z.object({ id: z.string().min(1) }),
});
const DeleteAnonymousUserResponseSchema = z.object({ success: z.literal(true) });

/**
 * レート制限のDBストレージはテストごとのインメモリDBへ分離される。
 * 各シナリオの意図も明確にするため一意のIP（RFC 5737 TEST-NET-2）を使う。
 */
let ipCounter = 0;

/**
 * テストごとに独立したインメモリDB＋authインスタンスを生成する。
 * 注意: libsqlの:memory:は既定でFOREIGN KEYが無効のため、
 * スレッド削除はFK cascadeではなくdatabaseHooksの動作検証になる。
 */
async function setup() {
  const client = createClient({ url: ":memory:" });
  const db = drizzle(client, { schema });
  await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
  const auth = createAuth({
    db,
    schema,
    baseURL: BASE_URL,
    secret: "unit-test-secret-key-0123456789",
  });
  ipCounter += 1;
  const ip = `198.51.100.${ipCounter}`;
  return { db, auth, ip };
}

type AuthHandler = { handler: (request: Request) => Promise<Response> };

function post(
  path: string,
  init?: { cookie?: string; ip?: string; body?: unknown },
) {
  return new Request(`${BASE_URL}/api/auth${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(init?.cookie ? { cookie: init.cookie } : {}),
      ...(init?.ip ? { "x-forwarded-for": init.ip } : {}),
    },
    body: JSON.stringify(init?.body ?? {}),
  });
}

function get(path: string, cookie?: string) {
  return new Request(`${BASE_URL}/api/auth${path}`, {
    headers: cookie ? { cookie } : {},
  });
}

function cookiesFrom(res: Response): string {
  return res.headers
    .getSetCookie()
    .map((cookie) => cookie.split(";")[0])
    .join("; ");
}

async function signInAnonymously(auth: AuthHandler, ip: string) {
  const res = await auth.handler(post("/sign-in/anonymous", { ip }));
  expect(res.status).toBe(200);
  const body = AnonymousSignInResponseSchema.parse(await res.json());
  return { cookie: cookiesFrom(res), userId: body.user.id };
}

describe("createAuth（匿名認証とセッション管理）", () => {
  it("匿名サインインで isAnonymous ユーザーとセッションクッキーを発行する", async () => {
    const { auth, ip } = await setup();

    const res = await auth.handler(post("/sign-in/anonymous", { ip }));

    expect(res.status).toBe(200);
    const body = AnonymousSignInResponseSchema.parse(await res.json());
    expect(body.user.isAnonymous).toBe(true);
    expect(body.token).toBeTruthy();
    expect(cookiesFrom(res)).toContain("better-auth.session_token=");
  });

  it("発行されたクッキーで get-session が同一ユーザーを返す", async () => {
    const { auth, ip } = await setup();
    const { cookie, userId } = await signInAnonymously(auth, ip);

    const res = await auth.handler(get("/get-session", cookie));

    expect(res.status).toBe(200);
    const body = SessionResponseSchema.parse(await res.json());
    expect(body.user.id).toBe(userId);
  });

  it("クッキーなしの get-session は null を返す", async () => {
    const { auth } = await setup();

    const res = await auth.handler(get("/get-session"));

    expect(res.status).toBe(200);
    expect(await res.json()).toBeNull();
  });

  it("セッションの有効期限はおよそ24時間", async () => {
    const { auth, ip } = await setup();
    const response = await auth.handler(post("/sign-in/anonymous", { ip }));
    const sessionCookie = response.headers.getSetCookie()
      .find(cookie => cookie.startsWith("better-auth.session_token="));
    expect(sessionCookie).toBeDefined();
    const maxAgeMatch = /max-age=(\d+)/iu.exec(sessionCookie ?? "");
    const expiresMatch = /expires=([^;]+)/iu.exec(sessionCookie ?? "");
    const remainingMs = maxAgeMatch?.[1]
      ? Number(maxAgeMatch[1]) * 1_000
      : new Date(expiresMatch?.[1] ?? 0).getTime() - Date.now();
    expect(Number.isFinite(remainingMs)).toBe(true);
    expect(remainingMs).toBeGreaterThan(23 * HOUR_MS);
    expect(remainingMs).toBeLessThanOrEqual(25 * HOUR_MS);
  });

  it("delete-anonymous-user がデータを削除しEve履歴を失効する", async () => {
    const { auth, db, ip } = await setup();
    const { cookie, userId } = await signInAnonymously(auth, ip);
    await db.insert(schema.threads).values({
      id: "thread-1",
      userId,
      title: "テストスレッド",
    });
    await db.insert(schema.eveSessionBindings).values({
      sessionId: "eve-session-1",
      threadId: "thread-1",
      userId,
    });

    const res = await auth.handler(post("/delete-anonymous-user", { cookie }));

    expect(res.status).toBe(200);
    expect(DeleteAnonymousUserResponseSchema.parse(await res.json()).success).toBe(true);
    const expiredSession = await auth.handler(get("/get-session", cookie));
    expect(expiredSession.status).toBe(200);
    expect(await expiredSession.json()).toBeNull();
    expect((await auth.handler(post("/delete-anonymous-user", { cookie }))).status).toBe(401);
  });

  it("未認証の delete-anonymous-user は 401 を返す", async () => {
    const { auth } = await setup();

    const res = await auth.handler(post("/delete-anonymous-user"));

    expect(res.status).toBe(401);
  });

  it("メール/パスワードのサインアップは既定で拒否される", async () => {
    const { auth } = await setup();

    const res = await auth.handler(
      post("/sign-up/email", {
        body: {
          name: "テストユーザー",
          email: "user@example.com",
          password: "password-1234",
        },
      }),
    );

    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  it("同一IPからの匿名サインイン4連続は 429 を返す", async () => {
    const { auth, ip } = await setup();

    const statuses: number[] = [];
    for (let i = 0; i < 4; i += 1) {
      const res = await auth.handler(post("/sign-in/anonymous", { ip }));
      statuses.push(res.status);
    }

    expect(statuses.slice(0, 3)).toEqual([200, 200, 200]);
    expect(statuses[3]).toBe(429);
  });
});
