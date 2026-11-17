import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    root: __dirname,
  },
  
  // Allow the ngrok domain to connect to the dev server
  images: { remotePatterns: [{ hostname: "*.ngrok-free.dev" }] }, // Optional: if using images
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [{ key: "ngrok-skip-browser-warning", value: "true" }],
      },
      {
        source: "/queue/:path*",
        headers: [
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          { key: "Cross-Origin-Embedder-Policy", value: "credentialless" },
        ],
      },
    ];
  },
  allowedDevOrigins: ["untensing-heike-burdensome.ngrok-free.dev"]
};

export default nextConfig;
