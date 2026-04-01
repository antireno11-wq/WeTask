import type { MetadataRoute } from "next";

import { resolvePublicAppUrl } from "@/lib/public-app-url";
import { CORE_SERVICES } from "@/lib/core-services";

const STATIC_PATHS = [
  "",
  "/como-funciona",
  "/sobre-nosotros",
  "/ayuda-soporte",
  "/trabaja-con-nosotros",
  "/legal",
  "/servicios",
  "/ingresar",
  "/registro"
];

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = resolvePublicAppUrl();
  const now = new Date();

  const staticEntries: MetadataRoute.Sitemap = STATIC_PATHS.map((path) => ({
    url: `${baseUrl}${path}`,
    lastModified: now,
    changeFrequency: path === "" ? "daily" : "weekly",
    priority: path === "" ? 1 : 0.7
  }));

  const categoryEntries: MetadataRoute.Sitemap = CORE_SERVICES.flatMap((service) => [
    {
      url: `${baseUrl}/servicios/${service.categorySlug}`,
      lastModified: now,
      changeFrequency: "daily" as const,
      priority: 0.9
    },
    {
      url: `${baseUrl}/servicios/${service.categorySlug}/pros`,
      lastModified: now,
      changeFrequency: "daily" as const,
      priority: 0.8
    }
  ]);

  try {
    if (!process.env.DATABASE_URL) {
      return [...staticEntries, ...categoryEntries];
    }

    const { prisma } = await import("@/lib/prisma");
    const profiles = await prisma.professionalProfile.findMany({
      where: {
        isVerified: true,
        user: {
          OR: [{ role: "PRO" }, { roleAssignments: { some: { role: { code: "PRO" } } } }]
        }
      },
      select: {
        userId: true,
        updatedAt: true
      },
      orderBy: { updatedAt: "desc" },
      take: 5000
    });

    const profileEntries: MetadataRoute.Sitemap = profiles.flatMap((profile) => [
      {
        url: `${baseUrl}/pro/${profile.userId}`,
        lastModified: profile.updatedAt,
        changeFrequency: "daily" as const,
        priority: 0.8
      },
      {
        url: `${baseUrl}/profesionales/${profile.userId}`,
        lastModified: profile.updatedAt,
        changeFrequency: "daily" as const,
        priority: 0.6
      }
    ]);

    return [...staticEntries, ...categoryEntries, ...profileEntries];
  } catch {
    return [...staticEntries, ...categoryEntries];
  }
}
