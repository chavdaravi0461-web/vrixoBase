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
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          { key: 'X-Permitted-Cross-Domain-Policies', value: 'none' },
        ],
      },
      {
        source: '/api/:path*',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: 'https://vrixobase-api.onrender.com' },
          { key: 'Access-Control-Allow-Methods', value: 'GET,POST,PUT,PATCH,DELETE,OPTIONS' },
          { key: 'Access-Control-Allow-Headers', value: 'Content-Type, Authorization, x-api-key' },
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
