import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  // Relax build-time checks on CI providers (Netlify/Vercel)
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true },
  // Ensure Radix UI packages are transpiled for consistent ESM/CJS interop in prod builds
  // Fixes: Attempted import error for useControllableState during `next build`
  transpilePackages: [
    "@radix-ui/react-dialog",
    "@radix-ui/react-use-controllable-state",
    "@radix-ui/react-portal",
    "@radix-ui/react-context",
    "@radix-ui/react-compose-refs",
    "@radix-ui/react-id",
    "@radix-ui/react-focus-guards",
    "@radix-ui/react-focus-scope",
    "@radix-ui/react-dismissable-layer",
    "@radix-ui/react-presence",
    "@radix-ui/react-primitive",
    "@radix-ui/react-slot",
    "@radix-ui/primitive",
  ],
  // Allow dev requests from additional origins (LAN/IPs)
  // Configure via env `NEXT_DEV_ALLOWED_ORIGINS` as comma-separated list if needed
  // Docs: https://nextjs.org/docs/app/api-reference/config/next-config-js/allowedDevOrigins
  allowedDevOrigins: (
    process.env.NEXT_DEV_ALLOWED_ORIGINS
      ? process.env.NEXT_DEV_ALLOWED_ORIGINS.split(",").map((s) => s.trim()).filter(Boolean)
      : [
          "http://localhost:3000",
          "http://127.0.0.1:3000",
          "http://0.0.0.0:3000",
        ]
  ) as any,
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'images.unsplash.com' },
      { protocol: 'https', hostname: 'me7aitdbxq.ufs.sh' },
      { protocol: 'https', hostname: 'i.pinimg.com' },
      { protocol: 'https', hostname: 'in.pinterest.com' },
      { protocol: 'https', hostname: 'www.youtube.com' },
      { protocol: 'https', hostname: 'img.youtube.com' },
      { protocol: 'https', hostname: 'lszcuaduebvabtiifhbgp.supabase.co' }
    ],
    unoptimized: true
  }
};

export default nextConfig;
