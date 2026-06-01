import { NextRequest, NextResponse } from "next/server";
import { safeErrorDetail } from "@/lib/logger";
import { buildVerificationEmailTemplate, sendPlatformEmail } from "@/lib/notifications";
import { prisma } from "@/lib/prisma";
import { resolvePublicAppUrl } from "@/lib/public-app-url";
import { getClientIp, rateLimit, tooManyRequestsResponse } from "@/lib/rate-limit";
import { randomToken, sha256 } from "@/lib/security";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { email?: string };
    const email = body.email?.trim().toLowerCase();
    if (!email) return NextResponse.json({ error: "Email requerido" }, { status: 400 });
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      return NextResponse.json({ error: "Error en el correo" }, { status: 400 });
    }

    // AUTH-06: evita spam de correos de verificación (por email + IP).
    const rl = await rateLimit("auth.verify.request", `${getClientIp(req)}:${email}`, "3/h");
    if (!rl.success) return tooManyRequestsResponse(rl) as unknown as NextResponse;

    const user = await prisma.user.findUnique({ where: { email }, select: { id: true, authProvider: true, emailVerifiedAt: true } });
    if (!user) return NextResponse.json({ ok: true }, { status: 200 });
    if (user.authProvider !== "EMAIL") return NextResponse.json({ ok: true }, { status: 200 });
    if (user.emailVerifiedAt) return NextResponse.json({ ok: true, alreadyVerified: true }, { status: 200 });

    const code = randomToken(6).replace(/[^0-9]/g, "").slice(0, 6).padEnd(6, "0");
    const appUrl = resolvePublicAppUrl(req);
    await prisma.emailVerificationToken.create({
      data: {
        userId: user.id,
        tokenHash: sha256(code),
        expiresAt: new Date(Date.now() + 1000 * 60 * 10)
      }
    });

    const verifyUrl = new URL("/verificar-correo", appUrl);
    verifyUrl.searchParams.set("token", code);

    await sendPlatformEmail({
      to: email,
      subject: "Tu código de verificación WeTask",
      text:
        `Tu código de verificación es ${code}. Expira en 10 minutos.\n\n` +
        `También puedes verificarlo desde este enlace:\n${verifyUrl.toString()}`,
      html: buildVerificationEmailTemplate({
        fullName: "Hola",
        verifyUrl: verifyUrl.toString(),
        code,
        appUrl
      })
    });

    return NextResponse.json(
      {
        ok: true,
        codePreview: process.env.NODE_ENV !== "production" ? code : undefined,
        tokenPreview: process.env.NODE_ENV !== "production" ? code : undefined
      },
      { status: 200 }
    );
  } catch (error) {
    return NextResponse.json({ error: "No se pudo generar verificación", detail: safeErrorDetail(error) }, { status: 400 });
  }
}
