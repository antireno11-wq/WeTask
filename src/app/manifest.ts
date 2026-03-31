import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "WeTask",
    short_name: "WeTask",
    description: "Servicios a domicilio confiables con reserva, pago y seguimiento desde una sola app.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#173d80",
    theme_color: "#173d80",
    lang: "es-CL",
    icons: [
      {
        src: "/services/fabicon.jpeg",
        sizes: "1600x1600",
        type: "image/jpeg",
        purpose: "any"
      },
      {
        src: "/favicon.png",
        sizes: "3400x1900",
        type: "image/png",
        purpose: "any"
      },
      {
        src: "/logo-wetask-cropped.png",
        sizes: "3400x1900",
        type: "image/png",
        purpose: "maskable"
      }
    ]
  };
}
