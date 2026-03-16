import { NextResponse } from "next/server";
import { ensureMarketplaceDemoData } from "@/lib/marketplace-demo-data";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(_: Request, context: { params: { proId: string } }) {
  try {
    await ensureMarketplaceDemoData();

    const profile = await prisma.professionalProfile.findFirst({
      where: {
        userId: context.params.proId,
        user: { role: "PRO" }
      },
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            email: true,
            phone: true,
            cleaningOnboarding: {
              select: {
                profilePhotoUrl: true,
                shortDescription: true,
                yearsExperience: true,
                workMode: true,
                categorySlug: true,
                offeredServices: true,
                experienceTypes: true,
                languages: true,
                baseCommune: true,
                maxTravelKm: true
              }
            }
          }
        },
        slots: {
          where: { isAvailable: true, startsAt: { gte: new Date() } },
          orderBy: [{ startsAt: "asc" }],
          take: 30,
          include: { service: { select: { id: true, name: true } } }
        }
      }
    });

    if (!profile) {
      return NextResponse.json({ error: "Profesional no encontrado" }, { status: 404 });
    }

    return NextResponse.json({ professional: profile }, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      {
        error: "No se pudo cargar el profesional",
        detail: error instanceof Error ? error.message : "Error desconocido"
      },
      { status: 400 }
    );
  }
}
