import type { NextConfig } from "next";
import { withEve } from "eve/next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@libsql/client"],
};

export default withEve(nextConfig);
