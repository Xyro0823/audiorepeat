import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Lets phones on this Wi-Fi network load Next's development assets while
  // testing through the current Wi-Fi IPv4 address. This is development-only and has
  // no effect on the deployed website.
  allowedDevOrigins: ['10.0.0.33', '10.0.0.46'],
  // Google/Firebase profile photos are served from lh3.googleusercontent.com;
  // allow next/image to load them for the avatar in the header/checkout.
  images: {
    remotePatterns: [{ protocol: "https", hostname: "lh3.googleusercontent.com" }],
  },
};

export default nextConfig;
