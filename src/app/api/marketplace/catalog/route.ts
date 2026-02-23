import { NextResponse } from "next/server";
import { ensureMarketplaceDemoData } from "@/lib/marketplace-demo-data";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await ensureMarketplaceDemoData();

    const categories = await prisma.category.findMany({
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

    return NextResponse.json({ categories }, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      {
        error: "No se pudo cargar el catalogo",
        detail: error instanceof Error ? error.message : "Error desconocido"
      },
      { status: 400 }
    );
  }
}
