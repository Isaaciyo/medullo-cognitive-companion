/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    typedRoutes: false,
  },
  // `standalone` produces a minimal node_modules + .next/standalone output
  // that the Dockerfile copies into a slim runtime image. Vercel ignores
  // this setting and uses its own build pipeline — no harm either way.
  output: "standalone",
};

module.exports = nextConfig;
