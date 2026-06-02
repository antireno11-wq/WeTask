import { NextResponse } from "next/server";
import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const SERVICES_TAG = "marketplace:services";

const getServices = unstable_cache(
  async () => {
    return prisma.service.findMany({
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
    });
  },
  ["marketplace:services:v1"],
  { revalidate: 300, tags: [SERVICES_TAG] }
);

export async function GET() {
  try {
    const services = await getServices();

    return NextResponse.json({ services }, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      {
        error: "No se pudieron listar los servicios",
        detail: error instanceof Error ? error.message : "Error desconocido"
      },
      { status: 400 }
    );
  }
}
