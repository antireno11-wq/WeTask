import { UserRole } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { getRequestIdentity, hasRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sha256 } from "@/lib/security";
import { cleaningOnboardingPhoneVerifySchema } from "@/lib/validators";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const identity = getRequestIdentity(req);
    if (!hasRole(identity.role, [UserRole.PRO, UserRole.ADMIN]) || !identity.userId) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const body = await req.json();
    const input = cleaningOnboardingPhoneVerifySchema.parse(body);

    const onboarding = await prisma.cleaningOnboarding.findUnique({ where: { userId: identity.userId } });
    if (!onboarding || !onboarding.phoneVerificationCodeHash || !onboarding.phoneVerificationExpiresAt) {
      return NextResponse.json({ error: "Primero solicita un codigo de verificacion" }, { status: 400 });
    }

    if (onboarding.phoneVerificationExpiresAt.getTime() < Date.now()) {
      return NextResponse.json({ error: "El codigo expiro. Solicita uno nuevo" }, { status: 400 });
    }

    if (sha256(input.code) !== onboarding.phoneVerificationCodeHash) {
      return NextResponse.json({ error: "Codigo incorrecto" }, { status: 400 });
    }

    const updated = await prisma.cleaningOnboarding.update({
      where: { id: onboarding.id },
      data: {
        phoneValidatedAt: new Date(),
        phoneVerificationCodeHash: null,
        phoneVerificationExpiresAt: null,
        currentStep: Math.max(onboarding.currentStep, 8)
      }
    });

    return NextResponse.json({ ok: true, onboarding: updated }, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      {
        error: "No se pudo validar telefono",
        detail: error instanceof Error ? error.message : "Error desconocido"
      },
      { status: 400 }
    );
  }
}
