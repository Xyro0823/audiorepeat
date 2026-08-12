import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Google/Firebase profile photos are served from lh3.googleusercontent.com;
  // allow next/image to load them for the avatar in the header/checkout.
  images: {
    remotePatterns: [{ protocol: "https", hostname: "lh3.googleusercontent.com" }],
  },
};

export default nextConfig;
