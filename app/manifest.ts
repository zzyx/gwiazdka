import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Gwiazdki",
    short_name: "Gwiazdki",
    description: "Check off your tasks and earn gwiazdki.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#e0f2fe",
    theme_color: "#e0f2fe",
    icons: [
      { src: "/icon/192", sizes: "192x192", type: "image/png" },
      { src: "/icon/512", sizes: "512x512", type: "image/png" },
    ],
  };
}
