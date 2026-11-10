import type { NextConfig } from "next";

// PayPal JS SDK (buttons, messages, hosted fields) and the Vercel Blob client upload are the only third parties the browser talks to.
const paypal = "https://www.paypal.com https://www.sandbox.paypal.com https://*.paypal.com https://*.paypalobjects.com";
const blob = "https://*.public.blob.vercel-storage.com";

// ENFORCED: only directives that cannot break the PayPal buttons or Next's inline scripts (clickjacking, <base>, plugins).
const enforcedCsp = "frame-ancestors 'none'; base-uri 'self'; object-src 'none'";

// REPORT-ONLY: the full policy we intend to enforce. Watch the browser console / reports, then promote it. script-src
// still needs 'unsafe-inline' for Next's inline bootstrap scripts (a nonce setup would replace it); dev also needs eval for HMR.
const reportOnlyCsp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${process.env.NODE_ENV === "production" ? "" : " 'unsafe-eval'"} ${paypal}`,
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob: ${blob} ${paypal}`,
  "font-src 'self' data:",
  `connect-src 'self' ${paypal} https://vercel.com https://*.vercel-storage.com`,
  `frame-src ${paypal}`,
  "worker-src 'self' blob:",
  "form-action 'self'",
].join("; ");

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(self \"https://www.paypal.com\" \"https://www.sandbox.paypal.com\")" },
  { key: "Content-Security-Policy", value: enforcedCsp },
  { key: "Content-Security-Policy-Report-Only", value: reportOnlyCsp },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // scripts/dev-isolated.mjs builds into .next-isolated so it can run next to the normal dev server.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  // PayPal Agent Toolkit pulls in large SDKs; load it from node_modules at runtime instead of bundling it.
  serverExternalPackages: ["@paypal/agent-toolkit"],
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
