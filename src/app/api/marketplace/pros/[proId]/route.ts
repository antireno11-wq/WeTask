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
        user: {
          OR: [{ role: "PRO" }, { roleAssignments: { some: { role: { code: "PRO" } } } }]
        }
      },
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            cleaningOnboarding: {
              select: {
                profilePhotoUrl: true,
                shortDescription: true,
                yearsExperience: true,
                workMode: true,
                categorySlug: true,
                offeredServices: true,
                experienceTypes: true,
                cleaningScope: true,
                petScope: true,
                makeupScope: true,
                ironingScope: true,
                babysitterScope: true,
                chefScope: true,
                trainerScope: true,
                teacherScope: true,
                acceptsHomesWithPets: true,
                acceptsHomesWithChildren: true,
                bringsOwnProducts: true,
                bringsOwnTools: true,
                languages: true,
                baseCommune: true,
                maxTravelKm: true,
                serviceCommunes: true,
                // PRO-02: NO exponer las storage keys de cédula/antecedentes en endpoint público.
                // Sólo se derivan flags booleanos más abajo.
                identityDocumentFrontFile: true,
                identityDocumentBackFile: true,
                criminalRecordFile: true
              }
            }
          }
        },
        taskerServices: {
          where: { isActive: true },
          select: {
            priceClp: true,
            category: {
              select: {
                slug: true,
                name: true
              }
            },
            service: {
              select: {
                id: true,
                name: true
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

    // PRO-02: serializa con lista blanca. Reemplaza las storage keys de documentos por
    // flags booleanos y nunca devuelve email/phone en este endpoint público.
    const onboarding = profile.user.cleaningOnboarding;
    const { identityDocumentFrontFile, identityDocumentBackFile, criminalRecordFile, ...safeOnboarding } =
      onboarding ?? ({} as NonNullable<typeof onboarding>);

    const professional = {
      ...profile,
      user: {
        ...profile.user,
        cleaningOnboarding: onboarding
          ? {
              ...safeOnboarding,
              hasIdentityDocuments: Boolean(identityDocumentFrontFile && identityDocumentBackFile),
              hasCriminalRecord: Boolean(criminalRecordFile)
            }
          : null
      }
    };

    return NextResponse.json({ professional }, { status: 200 });
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
