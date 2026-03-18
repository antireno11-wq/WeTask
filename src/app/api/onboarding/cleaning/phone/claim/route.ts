import { UserRole } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { getRequestIdentity, hasRole } from "@/lib/auth";
import { decodeVerifiedPhone, PUBLIC_ONBOARDING_PHONE_VERIFIED_COOKIE } from "@/lib/onboarding-phone";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const identity = getRequestIdentity(req);
    if (!hasRole(identity.role, [UserRole.PRO, UserRole.ADMIN]) || !identity.userId) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const verifiedPhone = decodeVerifiedPhone(req.cookies.get(PUBLIC_ONBOARDING_PHONE_VERIFIED_COOKIE)?.value);
    if (!verifiedPhone?.verified || !verifiedPhone.phone?.trim()) {
      return NextResponse.json({ error: "No encontramos una verificación de teléfono pendiente para asociar." }, { status: 400 });
    }

    const onboarding = await prisma.cleaningOnboarding.findUnique({
      where: { userId: identity.userId },
      include: { user: { select: { phone: true } } }
    });
    if (!onboarding) {
      return NextResponse.json({ error: "No encontramos tu onboarding activo." }, { status: 404 });
    }

    const currentPhone = onboarding.user.phone?.trim() ?? "";
    if (!currentPhone || currentPhone !== verifiedPhone.phone.trim()) {
      return NextResponse.json(
        {
          error: "El teléfono verificado no coincide con el que estás usando en este registro."
        },
        { status: 400 }
      );
    }

    const updated = await prisma.cleaningOnboarding.update({
      where: { id: onboarding.id },
      data: {
        phoneValidatedAt: onboarding.phoneValidatedAt ?? new Date()
      }
    });

    return NextResponse.json({ ok: true, onboarding: updated }, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      {
        error: "No pudimos asociar la verificación del teléfono",
        detail: error instanceof Error ? error.message : "Error desconocido"
      },
      { status: 400 }
    );
  }
}
