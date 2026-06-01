import { UserRole } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import { getRequestIdentity, hasRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { rateLimit, tooManyRequestsResponse } from "@/lib/rate-limit";
import { sha256 } from "@/lib/security";
import { cleaningOnboardingPhoneVerifySchema } from "@/lib/validators";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const identity = getRequestIdentity(req);
    if (!hasRole(identity.role, [UserRole.PRO, UserRole.ADMIN]) || !identity.userId) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    // PRO-05: limita la fuerza bruta del código OTP de 6 dígitos por usuario.
    const rl = await rateLimit("otp.verify", identity.userId, "10/h");
    if (!rl.success) return tooManyRequestsResponse(rl) as unknown as NextResponse;

    const body = await req.json();
    const input = cleaningOnboardingPhoneVerifySchema.parse(body);

    const onboarding = await prisma.cleaningOnboarding.findUnique({ where: { userId: identity.userId } });
    if (!onboarding || !onboarding.phoneVerificationCodeHash || !onboarding.phoneVerificationExpiresAt) {
      return NextResponse.json({ error: "Primero solicita un código de verificación" }, { status: 400 });
    }

    if (onboarding.phoneVerificationExpiresAt.getTime() < Date.now()) {
      return NextResponse.json({ error: "El código expiró. Solicita uno nuevo" }, { status: 400 });
    }

    if (sha256(input.code) !== onboarding.phoneVerificationCodeHash) {
      return NextResponse.json({ error: "Código incorrecto" }, { status: 400 });
    }

    const updated = await prisma.cleaningOnboarding.update({
      where: { id: onboarding.id },
      data: {
        phoneValidatedAt: new Date(),
        phoneVerificationCodeHash: null,
        phoneVerificationExpiresAt: null,
        currentStep: Math.max(onboarding.currentStep, 9)
      }
    });

    return NextResponse.json({ ok: true, onboarding: updated }, { status: 200 });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        {
          error: "Código incorrecto"
        },
        { status: 400 }
      );
    }
    return NextResponse.json(
      {
        error: "No se pudo validar teléfono",
        detail: error instanceof Error ? error.message : "Error desconocido"
      },
      { status: 400 }
    );
  }
}
