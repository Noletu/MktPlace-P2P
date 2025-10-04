/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@mktplace/shared', '@mktplace/ui'],
  webpack: (config) => {
    config.externals.push('pino-pretty', 'encoding');
    return config;
  },
}

module.exports = nextConfig
