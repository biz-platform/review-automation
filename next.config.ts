import type { NextConfig } from "next";

/** 프로덕션만: 랜딩(외부 CDN 스크립트/폰트) + Next 번들 + Supabase */
const productionContentSecurityPolicy = [
  "default-src 'self'",
  [
    "script-src",
    "'self'",
    "'unsafe-inline'",
    "'unsafe-eval'",
    "https://stunningw.com",
    "https://unpkg.com",
  ].join(" "),
  [
    "style-src",
    "'self'",
    "'unsafe-inline'",
    "https://fonts.googleapis.com",
    "https://cdn.jsdelivr.net",
    "https://hangeul.pstatic.net",
    "https://stunningw.com",
    "https://unpkg.com",
    "https://koreastunning.github.io",
  ].join(" "),
  [
    "font-src",
    "'self'",
    "data:",
    "https://fonts.gstatic.com",
    "https://cdn.jsdelivr.net",
    "https://hangeul.pstatic.net",
  ].join(" "),
  "img-src 'self' data: https: blob:",
  [
    "connect-src",
    "'self'",
    "https://*.supabase.co",
    "wss://*.supabase.co",
    "https://vitals.vercel-insights.com",
  ].join(" "),
  "frame-ancestors 'self'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
  "upgrade-insecure-requests",
].join("; ");

function securityHeaders(): { key: string; value: string }[] {
  const base: { key: string; value: string }[] = [
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    { key: "X-Frame-Options", value: "SAMEORIGIN" },
    {
      key: "Permissions-Policy",
      value:
        "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()",
    },
  ];

  if (process.env.NODE_ENV !== "production") {
    return base;
  }

  return [
    ...base,
    {
      key: "Strict-Transport-Security",
      value: "max-age=63072000; includeSubDomains",
    },
    { key: "Content-Security-Policy", value: productionContentSecurityPolicy },
  ];
}

const nextConfig: NextConfig = {
  async rewrites() {
    return [{ source: "/", destination: "/landing/index.html" }];
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders(),
      },
    ];
  },
};

export default nextConfig;
