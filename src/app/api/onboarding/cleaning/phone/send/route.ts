import { UserRole } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { getRequestIdentity, hasRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { randomToken, sha256 } from "@/lib/security";
import { cleaningOnboardingPhoneSendSchema } from "@/lib/validators";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const identity = getRequestIdentity(req);
    if (!hasRole(identity.role, [UserRole.PRO, UserRole.ADMIN]) || !identity.userId) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const body = await req.json();
    const input = cleaningOnboardingPhoneSendSchema.parse(body);

    const onboarding = await prisma.cleaningOnboarding.upsert({
      where: { userId: identity.userId },
      create: { userId: identity.userId },
      update: {}
    });

    const user = await prisma.user.findUnique({ where: { id: identity.userId }, select: { phone: true } });
    const phone = (input.phone ?? user?.phone ?? "").trim();
    if (phone.length < 7) {
      return NextResponse.json({ error: "Debes ingresar un telefono valido" }, { status: 400 });
    }

    const code = randomToken(6).replace(/[^0-9]/g, "").slice(0, 6).padEnd(6, "0");
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await prisma.$transaction([
      prisma.user.update({ where: { id: identity.userId }, data: { phone } }),
      prisma.cleaningOnboarding.update({
        where: { id: onboarding.id },
        data: {
          phoneVerificationCodeHash: sha256(code),
          phoneVerificationExpiresAt: expiresAt,
          phoneValidatedAt: null
        }
      })
    ]);

    return NextResponse.json(
      {
        ok: true,
        message: "Codigo de verificacion enviado",
        codePreview: process.env.NODE_ENV !== "production" ? code : undefined,
        expiresAt
      },
      { status: 200 }
    );
  } catch (error) {
    return NextResponse.json(
      {
        error: "No se pudo enviar codigo de verificacion",
        detail: error instanceof Error ? error.message : "Error desconocido"
      },
      { status: 400 }
    );
  }
}
