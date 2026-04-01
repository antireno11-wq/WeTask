import type { MetadataRoute } from "next";

import { resolvePublicAppUrl } from "@/lib/public-app-url";

export default function robots(): MetadataRoute.Robots {
  const baseUrl = resolvePublicAppUrl();

  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin", "/api", "/cliente", "/notificaciones", "/pro/reservas", "/booking"]
    },
    sitemap: `${baseUrl}/sitemap.xml`,
    host: baseUrl
  };
}
