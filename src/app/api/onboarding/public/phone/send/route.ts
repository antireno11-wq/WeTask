import { NextRequest, NextResponse } from "next/server";
import {
  encodePendingPhoneVerification,
  PUBLIC_ONBOARDING_PHONE_COOKIE,
  PUBLIC_ONBOARDING_PHONE_VERIFIED_COOKIE
} from "@/lib/onboarding-phone";
import { randomToken, sha256 } from "@/lib/security";
import { sendTwilioSms } from "@/lib/twilio-sms";
import { cleaningOnboardingPhoneSendSchema } from "@/lib/validators";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const input = cleaningOnboardingPhoneSendSchema.parse(body);
    const phone = (input.phone ?? "").trim();

    if (phone.length < 7) {
      return NextResponse.json({ error: "Debes ingresar un telefono valido" }, { status: 400 });
    }

    const code = randomToken(6).replace(/[^0-9]/g, "").slice(0, 6).padEnd(6, "0");
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
    const previewAllowed = process.env.NODE_ENV !== "production" || process.env.SMS_CODE_PREVIEW === "1";

    const smsResult = await sendTwilioSms({
      to: phone,
      body: `WeTask: tu codigo de verificacion es ${code}. Expira en 10 minutos.`
    });

    if (!smsResult.ok) {
      if (smsResult.reason === "invalid_phone") {
        return NextResponse.json({ error: smsResult.detail || "Telefono invalido" }, { status: 400 });
      }
      if (!(smsResult.reason === "not_configured" && previewAllowed)) {
        return NextResponse.json(
          {
            error: "No se pudo enviar SMS de verificacion",
            detail: smsResult.detail || "Revisa variables TWILIO_* en el servidor"
          },
          { status: 502 }
        );
      }
    }

    const response = NextResponse.json(
      {
        ok: true,
        message: "Codigo de verificacion enviado",
        codePreview: previewAllowed ? code : undefined,
        smsProvider: smsResult.ok ? "twilio" : "preview",
        expiresAt
      },
      { status: 200 }
    );

    response.cookies.set({
      name: PUBLIC_ONBOARDING_PHONE_COOKIE,
      value: encodePendingPhoneVerification({
        phone,
        codeHash: sha256(code),
        exp: Math.floor(expiresAt.getTime() / 1000)
      }),
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 10
    });
    response.cookies.set({
      name: PUBLIC_ONBOARDING_PHONE_VERIFIED_COOKIE,
      value: "",
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 0
    });

    return response;
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
