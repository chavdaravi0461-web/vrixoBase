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

// Docker builds (NEXT_STANDALONE=1) need output: 'standalone' for the traced server
// Vercel sets its own output mode — do NOT set it here
if (process.env.NEXT_STANDALONE) {
  nextConfig.output = 'standalone';
}

module.exports = nextConfig;
