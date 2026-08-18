import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: process.env.ALLOWED_ORIGIN || '*' },
          { key: 'Access-Control-Allow-Methods', value: 'GET, POST, OPTIONS, PUT, DELETE, PATCH' },
          { key: 'Access-Control-Allow-Headers', value: 'Content-Type, Authorization, x-test-auth-secret, x-test-user-id, x-test-is-supervisor' },
        ],
      },
    ];
  },
};
export default nextConfig;
