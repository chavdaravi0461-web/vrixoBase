const isVercel = process.env.VERCEL === '1';

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      { protocol: 'http', hostname: 'localhost', pathname: '/**' },
      { protocol: 'https', hostname: 'localhost', pathname: '/**' },
      { protocol: 'http', hostname: 'minio', pathname: '/**' },
      { protocol: 'https', hostname: 'minio', pathname: '/**' },
      { protocol: 'https', hostname: '**.vercel.app', pathname: '/**' },
    ],
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        ],
      },
    ];
  },
  experimental: {
    serverActions: { bodySizeLimit: '5mb' },
  },
};

if (!isVercel) {
  nextConfig.output = 'standalone';
  nextConfig.distDir = 'build';
  nextConfig.serverExternalPackages = [];
}

module.exports = nextConfig;
