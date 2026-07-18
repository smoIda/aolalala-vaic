import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  // Emit a self-contained .next/standalone bundle for a lean Docker image
  // (see docker-compose.vps.yml / frontend/Dockerfile).
  // output: "standalone",
  // // Pin the trace root to this project dir. Without it, a stray lockfile above
  // // the repo makes Next infer the wrong workspace root and nest the standalone
  // // output under the full path (…/standalone/Downloads/…/frontend/server.js),
  // // breaking the Dockerfile's COPY paths. cwd is the project dir under
  // // `next build`, so this keeps server.js at .next/standalone/server.js.
  // outputFileTracingRoot: process.cwd(),
};

export default nextConfig;
