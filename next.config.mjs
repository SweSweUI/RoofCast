/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // `node:sqlite` is a Node builtin (node: scheme) — Next never bundles it, so
  // no externals config is required. Route handlers that use it set
  // `export const runtime = 'nodejs'`.
};

export default nextConfig;
