import { NextRequest, NextResponse } from "next/server";
import {
  decodePendingPhoneVerification,
  encodeVerifiedPhone,
  PUBLIC_ONBOARDING_PHONE_COOKIE,
  PUBLIC_ONBOARDING_PHONE_VERIFIED_COOKIE
} from "@/lib/onboarding-phone";
import { sha256 } from "@/lib/security";
import { cleaningOnboardingPhoneVerifySchema } from "@/lib/validators";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const input = cleaningOnboardingPhoneVerifySchema.parse(body);
    const pending = decodePendingPhoneVerification(req.cookies.get(PUBLIC_ONBOARDING_PHONE_COOKIE)?.value);

    if (!pending) {
      return NextResponse.json({ error: "Primero solicita un codigo de verificacion" }, { status: 400 });
    }

    if (pending.exp < Math.floor(Date.now() / 1000)) {
      return NextResponse.json({ error: "El codigo expiro. Solicita uno nuevo" }, { status: 400 });
    }

    if (sha256(input.code) !== pending.codeHash) {
      return NextResponse.json({ error: "Codigo incorrecto" }, { status: 400 });
    }

    const response = NextResponse.json({ ok: true, phone: pending.phone }, { status: 200 });
    response.cookies.set({
      name: PUBLIC_ONBOARDING_PHONE_COOKIE,
      value: "",
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 0
    });
    response.cookies.set({
      name: PUBLIC_ONBOARDING_PHONE_VERIFIED_COOKIE,
      value: encodeVerifiedPhone({
        phone: pending.phone,
        verified: true,
        exp: Math.floor(Date.now() / 1000) + 60 * 60 * 6
      }),
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 6
    });
    return response;
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
