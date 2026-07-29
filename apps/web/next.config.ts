import type { NextConfig } from 'next';

const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
let apiOrigin = 'http://localhost:4000';
try {
  apiOrigin = new URL(apiUrl).origin;
} catch {
  // keep default
}

// Object storage origin — the browser PUTs upload parts and GETs downloads
// directly against presigned URLs, so CSP connect-src must allow it.
const storageUrl = process.env.NEXT_PUBLIC_STORAGE_URL || 'http://localhost:9000';
let storageOrigin = 'http://localhost:9000';
try {
  storageOrigin = new URL(storageUrl).origin;
} catch {
  // keep default
}

const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://pagead2.googlesyndication.com https://www.googletagservices.com https://www.google.com https://partner.googleadservices.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com data:",
  "img-src 'self' data: blob: https:",
  `connect-src 'self' ${apiOrigin} ${storageOrigin} https://pagead2.googlesyndication.com`,
  "worker-src 'self' blob:",
  "frame-src 'self' https://googleads.g.doubleclick.net https://tpc.googlesyndication.com",
  "object-src 'none'",
  "base-uri 'self'",
  "frame-ancestors 'none'",
  "form-action 'self'",
].join('; ');

const securityHeaders = [
  { key: 'Content-Security-Policy', value: csp },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'X-Frame-Options', value: 'DENY' },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
  },
];

const nextConfig: NextConfig = {
  output: 'standalone',
  transpilePackages: ['@pdfnexus/shared', 'pdfjs-dist', 'pdfstudio'],
  experimental: {
    optimizePackageImports: ['lucide-react'],
  },
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
    };
    config.experiments = {
      ...config.experiments,
      asyncWebAssembly: true,
    };
    return config;
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
