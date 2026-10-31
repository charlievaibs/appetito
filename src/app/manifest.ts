import type { MetadataRoute } from "next";

/**
 * Manifiesto de la PWA: es lo que permite «Instalar app» en Chrome y «Añadir a pantalla
 * de inicio». Al abrirla instalada se va directo a la vista del comensal.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Appetito",
    short_name: "Appetito",
    description: "Pide desde tu mesa y ajusta tu plato sin llamar al mesero.",
    lang: "es",
    start_url: "/app",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#fffaf5",
    theme_color: "#e8452c",
    categories: ["food", "lifestyle"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Mi mesa", url: "/mesa", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Panel del restaurante", url: "/panel", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
    ],
  };
}
