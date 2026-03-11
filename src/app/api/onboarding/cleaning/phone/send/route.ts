import { UserRole } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { getRequestIdentity, hasRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { randomToken, sha256 } from "@/lib/security";
import { sendTwilioSms } from "@/lib/twilio-sms";
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
    const isProduction = process.env.NODE_ENV === "production";
    const previewAllowed = !isProduction || process.env.SMS_CODE_PREVIEW === "1";

    const smsResult = await sendTwilioSms({
      to: phone,
      body: `WeTask: tu codigo de verificacion es ${code}. Expira en 10 minutos.`
    });

    if (!smsResult.ok) {
      if (smsResult.reason === "invalid_phone") {
        return NextResponse.json({ error: smsResult.detail || "Telefono invalido" }, { status: 400 });
      }

      if (smsResult.reason === "not_configured" && previewAllowed) {
        // En desarrollo permitimos continuar con preview del codigo.
      } else {
        return NextResponse.json(
          {
            error: "No se pudo enviar SMS de verificacion",
            detail: smsResult.detail || "Revisa variables TWILIO_* en el servidor"
          },
          { status: 502 }
        );
      }
    }

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
        codePreview: previewAllowed ? code : undefined,
        smsProvider: smsResult.ok ? "twilio" : "preview",
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
