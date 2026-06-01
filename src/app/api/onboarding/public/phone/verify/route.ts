import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import {
  decodePendingPhoneVerification,
  encodeVerifiedPhone,
  PUBLIC_ONBOARDING_PHONE_COOKIE,
  PUBLIC_ONBOARDING_PHONE_VERIFIED_COOKIE
} from "@/lib/onboarding-phone";
import { getClientIp, rateLimit, tooManyRequestsResponse } from "@/lib/rate-limit";
import { sha256 } from "@/lib/security";
import { cleaningOnboardingPhoneVerifySchema } from "@/lib/validators";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    // PRO-05: limita la fuerza bruta del OTP por IP.
    const rl = await rateLimit("otp.verify.public", getClientIp(req), "10/h");
    if (!rl.success) return tooManyRequestsResponse(rl) as unknown as NextResponse;

    const body = await req.json();
    const input = cleaningOnboardingPhoneVerifySchema.parse(body);
    const pending = decodePendingPhoneVerification(req.cookies.get(PUBLIC_ONBOARDING_PHONE_COOKIE)?.value);

    if (!pending) {
      return NextResponse.json({ error: "Primero solicita un código de verificación" }, { status: 400 });
    }

    if (pending.exp < Math.floor(Date.now() / 1000)) {
      return NextResponse.json({ error: "El código expiró. Solicita uno nuevo" }, { status: 400 });
    }

    if (sha256(input.code) !== pending.codeHash) {
      return NextResponse.json({ error: "Código incorrecto" }, { status: 400 });
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
