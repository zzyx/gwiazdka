import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Lets an iPhone on the same Wi-Fi use `next dev` at http://<mac name>.local:3000.
  // See docs/local-setup-macos.md.
  allowedDevOrigins: ["*.local"],
};

export default nextConfig;
