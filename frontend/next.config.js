/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  distDir: 'build',
  images: {
    remotePatterns: [
      {
        protocol: 'http',
        hostname: 'localhost',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'localhost',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'http',
        hostname: 'minio',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'minio',
        port: '',
        pathname: '/**',
      },
    ],
  },

};

module.exports = nextConfig;
