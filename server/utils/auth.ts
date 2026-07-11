import { db, schema } from "@nuxthub/db";
import { createAuth } from "./create-auth";

const productionUrl = process.env.BETTER_AUTH_URL?.trim();

export const auth = createAuth({
  db,
  schema,
  baseURL: productionUrl,
  secret: process.env.BETTER_AUTH_SECRET,
  trustedOrigins: productionUrl ? [productionUrl] : undefined,
});
