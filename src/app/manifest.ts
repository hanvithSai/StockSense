import type { MetadataRoute } from "next";

/** Web app manifest: StockSense installs as a standalone app on desktops, tablets and phones. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "StockSense · Inventory Management",
    short_name: "StockSense",
    description: "Receipts, deliveries, transfers, adjustments and a live stock ledger for every warehouse.",
    id: "/",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    background_color: "#fbf9fb",
    theme_color: "#5b3a53",
    categories: ["business", "productivity"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "New receipt", url: "/operations/receipts/new" },
      { name: "New delivery order", url: "/operations/deliveries/new" },
      { name: "Stock", url: "/stock" },
      { name: "Move history", url: "/move-history" },
    ],
  };
}
