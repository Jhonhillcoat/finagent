/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  experimental: {
    serverComponentsExternalPackages: ["xlsx", "pdf-parse"],
  },
};

module.exports = nextConfig;
