import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: false,
  assetPrefix: "./",
  images: { unoptimized: true },
};

export default nextConfig;
