import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";

const appRoot = dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  output: "standalone",
  outputFileTracingRoot: appRoot,
  reactStrictMode: true,
  poweredByHeader: false,
  turbopack: {
    root: appRoot,
  },
};

export default nextConfig;
