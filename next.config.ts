import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  serverExternalPackages: ["unpdf", "mammoth"],
};

export default nextConfig;
