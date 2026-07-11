import { db } from "../db/client";
import * as schema from "../db/schema";
import { createAuth } from "./create-auth";

const productionUrl = process.env.BETTER_AUTH_URL?.trim();

export const auth = createAuth({
  db,
  schema,
  baseURL: productionUrl,
  secret: process.env.BETTER_AUTH_SECRET,
  trustedOrigins: productionUrl ? [productionUrl] : undefined,
  allowEmailPassword: process.env.NODE_ENV === "development",
});
