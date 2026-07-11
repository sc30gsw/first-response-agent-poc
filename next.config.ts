import type { NextConfig } from "next";
import { withEve } from "eve/next";

const isDevelopment = process.env.NODE_ENV === "development";
const contentSecurityPolicyDirectives = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDevelopment ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  `connect-src 'self'${isDevelopment ? " ws: wss:" : ""}`,
  "media-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "worker-src 'self' blob:",
] as const satisfies readonly string[];

const contentSecurityPolicy = contentSecurityPolicyDirectives.join("; ");
const OPENAPI_UI_SCRIPT_ORIGIN = "https://cdn.jsdelivr.net";
const openApiContentSecurityPolicy = contentSecurityPolicyDirectives
  .map(directive => directive.startsWith("script-src ")
    ? `${directive} ${OPENAPI_UI_SCRIPT_ORIGIN}`
    : directive)
  .join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
  { key: "Permissions-Policy", value: "camera=(), geolocation=(), microphone=()" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Robots-Tag", value: "noindex, nofollow" },
] as const satisfies readonly {
  readonly key: string;
  readonly value: string;
}[];

const openApiSecurityHeaders = [
  { key: "Content-Security-Policy", value: openApiContentSecurityPolicy },
] as const satisfies readonly {
  readonly key: string;
  readonly value: string;
}[];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  serverExternalPackages: ["@libsql/client"],
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [...securityHeaders],
      },
      {
        source: "/api/v1/openapi/:path*",
        // The interactive UI loads one pinned Scalar bundle. All other routes
        // keep the stricter first-party-only script policy above.
        headers: [...openApiSecurityHeaders],
      },
    ];
  },
};

export default withEve(nextConfig);
