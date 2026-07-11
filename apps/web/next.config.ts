import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";

const appRoot = dirname(fileURLToPath(import.meta.url));
const workspaceRoot = dirname(dirname(appRoot));

const nextConfig: NextConfig = {
  output: "standalone",
  outputFileTracingRoot: workspaceRoot,
  transpilePackages: ["@medario/firebase", "@medario/ui"],
  reactStrictMode: true,
  poweredByHeader: false,
  turbopack: {
    root: workspaceRoot,
  },
  async redirects() {
    return [
      { source: "/institucional.html", destination: "/institucional", permanent: true },
      { source: "/privacidade.html", destination: "/privacidade", permanent: true },
      { source: "/termos.html", destination: "/termos", permanent: true },
      { source: "/medicos/joinville.html", destination: "/medicos/joinville", permanent: true },
    ];
  },
};

export default nextConfig;
