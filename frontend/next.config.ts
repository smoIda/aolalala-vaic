import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  output: "standalone",
  outputFileTracingRoot: process.cwd(),
};

export default nextConfig;
