import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "AudioRepeat — Language Loop Driller",
    short_name: "AudioRepeat",
    description:
      "Offline-first, hands-free vocabulary looping for auditory language learners.",
    id: "/",
    scope: "/",
    // The installed app opens the signed-in practice dashboard (library +
    // player), not the marketing landing page. Signed-out users get the auth
    // screen there instead — still the app, never the marketing site.
    start_url: "/dashboard",
    display: "standalone",
    orientation: "portrait",
    lang: "en",
    categories: ["education", "productivity"],
    background_color: "#05050c",
    theme_color: "#05050c",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      {
        src: "/icons/icon-maskable.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    shortcuts: [
      {
        name: "New set",
        // Inside the app (the library lives on /dashboard) — never marketing.
        url: "/dashboard?new=1",
        description: "Create a new vocabulary set",
      },
      {
        name: "Review Today",
        url: "/review",
        description: "Practice words due for review",
      },
    ],
  };
}
