import path from 'node:path';
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
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' 'wasm-unsafe-eval' https://pagead2.googlesyndication.com https://www.googletagservices.com https://www.google.com https://partner.googleadservices.com https://apis.google.com https://accounts.google.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com data:",
  "img-src 'self' data: blob: https:",
  `connect-src 'self' ${apiOrigin} ${storageOrigin} https://pagead2.googlesyndication.com https://www.googleapis.com https://accounts.google.com https://oauth2.googleapis.com https://apis.google.com`,
  "worker-src 'self' blob:",
  "frame-src 'self' https://googleads.g.doubleclick.net https://tpc.googlesyndication.com https://docs.google.com https://drive.google.com https://accounts.google.com",
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
  // Monorepo: without this, Next scopes dependency tracing to apps/web and
  // silently omits the hoisted root node_modules from the standalone build.
  outputFileTracingRoot: path.join(__dirname, '../../'),
  transpilePackages: ['@pdfnexus/shared', 'pdfjs-dist', 'pdfstudio'],
  experimental: {
    optimizePackageImports: ['lucide-react'],
  },
  webpack: (config, { isServer, webpack }) => {
    // pdfstudio / qpdf.wasm glue references Node-only `node:` specifiers.
    // Those branches never run in the browser, but webpack still resolves them.
    config.plugins.push(
      new webpack.NormalModuleReplacementPlugin(/^node:/, (resource: {
        request: string;
      }) => {
        resource.request = resource.request.replace(/^node:/, '');
      }),
    );

    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        module: false,
        path: false,
        url: false,
        crypto: false,
        worker_threads: false,
        child_process: false,
        'fs/promises': false,
      };
    }

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
