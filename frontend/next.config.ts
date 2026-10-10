import type { NextConfig } from 'next';

const BACKEND_URL = process.env.BACKEND_URL ?? 'http://localhost:4000';

const nextConfig: NextConfig = {
  compress: true,
  reactStrictMode: true,
  productionBrowserSourceMaps: false,
  poweredByHeader: false,

  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${BACKEND_URL}/api/:path*`,
      },
    ];
  },

  async redirects() {
    return [
      {
        source: '/payment-settings',
        destination: '/platform/settings/payment',
        permanent: false,
      },
      {
        source: '/settings/payment',
        destination: '/platform/settings/payment',
        permanent: false,
      },
      {
        source: '/companies',
        destination: '/platform/companies',
        permanent: false,
      },
      {
        source: '/subscribers',
        destination: '/platform/subscribers',
        permanent: false,
      },
      {
        source: '/upgrade-requests',
        destination: '/platform/upgrade-requests',
        permanent: false,
      },
      {
        source: '/subscriptions',
        destination: '/platform/plans',
        permanent: false,
      },
      {
        source: '/audit',
        destination: '/platform/audit',
        permanent: false,
      },
      {
        source: '/invoices/templates',
        destination: '/platform/templates',
        permanent: false,
      },
      {
        source: '/invoices/templates/:path*',
        destination: '/platform/templates/:path*',
        permanent: false,
      },
    ];
  },

  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        ],
      },
    ];
  },

  images: {
    formats: ['image/avif', 'image/webp'],
  },

  experimental: {
    optimizePackageImports: [
      'lucide-react',
      '@radix-ui/react-avatar',
      '@radix-ui/react-dialog',
      '@radix-ui/react-dropdown-menu',
      'recharts',
    ],
  },
};

export default nextConfig;