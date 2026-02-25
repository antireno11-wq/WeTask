import { UserRole } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { getRequestIdentity, hasRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { marketplaceProProfileUpdateSchema } from "@/lib/validators";

export const dynamic = "force-dynamic";

function authorizedProId(req: NextRequest, identity: { userId: string | null; role: UserRole | null }) {
  const queryProId = req.nextUrl.searchParams.get("proId") ?? undefined;
  const targetProId = queryProId ?? identity.userId ?? undefined;
  if (!targetProId) return { error: "proId requerido" };
  if (identity.role === UserRole.PRO && identity.userId !== targetProId) return { error: "No autorizado" };
  return { targetProId };
}

export async function GET(req: NextRequest) {
  try {
    const identity = getRequestIdentity(req);
    if (!hasRole(identity.role, [UserRole.PRO, UserRole.ADMIN])) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const auth = authorizedProId(req, identity);
    if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.error === "No autorizado" ? 403 : 400 });

    const user = await prisma.user.findUnique({
      where: { id: auth.targetProId },
      select: {
        id: true,
        fullName: true,
        email: true,
        role: true,
        professionalProfile: true
      }
    });

    if (!user || user.role !== UserRole.PRO) {
      return NextResponse.json({ error: "Profesional no encontrado" }, { status: 404 });
    }

    return NextResponse.json(
      {
        user: { id: user.id, fullName: user.fullName, email: user.email },
        profile: user.professionalProfile
      },
      { status: 200 }
    );
  } catch (error) {
    return NextResponse.json(
      {
        error: "No se pudo cargar perfil del profesional",
        detail: error instanceof Error ? error.message : "Error desconocido"
      },
      { status: 400 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const identity = getRequestIdentity(req);
    if (!hasRole(identity.role, [UserRole.PRO, UserRole.ADMIN])) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const body = await req.json();
    const input = marketplaceProProfileUpdateSchema.parse(body);

    const targetProId = input.proId ?? identity.userId;
    if (!targetProId) {
      return NextResponse.json({ error: "proId requerido" }, { status: 400 });
    }

    if (identity.role === UserRole.PRO && identity.userId !== targetProId) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const user = await prisma.user.findUnique({ where: { id: targetProId }, select: { role: true } });
    if (!user || user.role !== UserRole.PRO) {
      return NextResponse.json({ error: "Profesional no valido" }, { status: 400 });
    }

    const profile = await prisma.professionalProfile.upsert({
      where: { userId: targetProId },
      create: {
        userId: targetProId,
        bio: input.bio ?? null,
        coverageStreet: input.coverageStreet ?? null,
        coverageComuna: input.coverageComuna ?? null,
        coverageCity: input.coverageCity ?? null,
        coveragePostal: input.coveragePostal ?? null,
        coverageLatitude: input.coverageLatitude ?? null,
        coverageLongitude: input.coverageLongitude ?? null,
        serviceRadiusKm: input.serviceRadiusKm ?? 8,
        hourlyRateFromClp: input.hourlyRateFromClp ?? null
      },
      update: {
        bio: input.bio,
        coverageStreet: input.coverageStreet,
        coverageComuna: input.coverageComuna,
        coverageCity: input.coverageCity,
        coveragePostal: input.coveragePostal,
        coverageLatitude: input.coverageLatitude,
        coverageLongitude: input.coverageLongitude,
        serviceRadiusKm: input.serviceRadiusKm,
        hourlyRateFromClp: input.hourlyRateFromClp
      }
    });

    return NextResponse.json({ profile }, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      {
        error: "No se pudo actualizar perfil del profesional",
        detail: error instanceof Error ? error.message : "Error desconocido"
      },
      { status: 400 }
    );
  }
}
