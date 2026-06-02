import { NextResponse } from "next/server";
import { unstable_cache } from "next/cache";
import { ensureMarketplaceDemoData } from "@/lib/marketplace-demo-data";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const CATALOG_TAG = "marketplace:catalog";

const getCatalog = unstable_cache(
  async () => {
    return prisma.category.findMany({
      where: { isActive: true },
      orderBy: [{ name: "asc" }],
      include: {
        services: {
          where: { isActive: true },
          orderBy: [{ name: "asc" }],
          select: {
            id: true,
            slug: true,
            name: true,
            description: true,
            basePriceClp: true,
            durationMin: true
          }
        }
      }
    });
  },
  ["marketplace:catalog:v1"],
  { revalidate: 300, tags: [CATALOG_TAG] }
);

export async function GET() {
  try {
    await ensureMarketplaceDemoData();

    const categories = await getCatalog();

    return NextResponse.json({ categories }, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      {
        error: "No se pudo cargar el catálogo",
        detail: error instanceof Error ? error.message : "Error desconocido"
      },
      { status: 400 }
    );
  }
}
