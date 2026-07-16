import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";

const appRoot = dirname(fileURLToPath(import.meta.url));
const workspaceRoot = dirname(dirname(appRoot));

const nextConfig: NextConfig = {
  output: "standalone",
  outputFileTracingRoot: workspaceRoot,
  transpilePackages: ["@medario/domain", "@medario/firebase", "@medario/ui"],
  reactStrictMode: true,
  poweredByHeader: false,
  turbopack: {
    root: workspaceRoot,
  },
  async headers() {
    return [{
      source: "/:path*",
      headers: [
        { key: "Content-Security-Policy", value: "default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; form-action 'self'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; script-src 'self' 'unsafe-inline' 'unsafe-eval'; connect-src 'self' https://*.googleapis.com https://*.firebaseio.com https://*.cloudfunctions.net; font-src 'self' data: https://fonts.gstatic.com;" },
        { key: "X-Frame-Options", value: "DENY" },
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        { key: "Permissions-Policy", value: "geolocation=(self), camera=(), microphone=()" },
        { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
      ],
    }];
  },
  async redirects() {
    return [
      {
        source: "/:path*",
        has: [{ type: "host", value: "www.medario.com.br" }],
        destination: "https://medario.com.br/:path*",
        permanent: true,
      },
      { source: "/institucional.html", destination: "/institucional", permanent: true },
      { source: "/privacidade.html", destination: "/privacidade", permanent: true },
      { source: "/termos.html", destination: "/termos", permanent: true },
      { source: "/medicos/joinville.html", destination: "/medicos/joinville", permanent: true },
    ];
  },
};

export default nextConfig;
