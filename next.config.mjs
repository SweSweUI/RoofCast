/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // `node:sqlite` is a Node builtin (node: scheme) — Next never bundles it, so
  // no externals config is required. Route handlers that use it set
  // `export const runtime = 'nodejs'`.
  experimental: {
    // Ensure the analyst notebook ships with its API route's serverless bundle
    // (it's read from disk at runtime, so file tracing must include it).
    outputFileTracingIncludes: {
      '/api/analyst-notebook': ['./notebooks/**'],
    },
  },
};

export default nextConfig;
