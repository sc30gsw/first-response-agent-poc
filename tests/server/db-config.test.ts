import { describe, expect, it } from "vitest";
import { resolveDatabaseCredentials } from "../../server/db/config";

describe("resolveDatabaseCredentials", () => {
  it("accepts the TURSO_URL name used by an existing deployment", () => {
    expect(resolveDatabaseCredentials({
      NODE_ENV: "test",
      TURSO_AUTH_TOKEN: "secret",
      TURSO_URL: "libsql://example.turso.io",
    })).toEqual({
      authToken: "secret",
      url: "libsql://example.turso.io",
    });
  });

  it("prefers TURSO_DATABASE_URL when both URL names are present", () => {
    expect(resolveDatabaseCredentials({
      NODE_ENV: "test",
      TURSO_AUTH_TOKEN: "secret",
      TURSO_DATABASE_URL: "libsql://canonical.turso.io",
      TURSO_URL: "libsql://alias.turso.io",
    })).toEqual({
      authToken: "secret",
      url: "libsql://canonical.turso.io",
    });
  });
});
