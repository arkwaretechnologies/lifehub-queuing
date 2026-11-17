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
      // Piper voice assets — long cache for repeat TV loads (bump paths if you change models).
      {
        source: "/piper/:path*",
        headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
      },
      {
        source: "/onnx/:path*",
        headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
      },
      {
        source: "/worker/:path*",
        headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
      },
      {
        source: "/piper-tts-web.js",
        headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
      },
    ];
  },
  allowedDevOrigins: ["untensing-heike-burdensome.ngrok-free.dev"]
};

export default nextConfig;
