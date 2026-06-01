import { NextRequest, NextResponse } from "next/server";
import { safeErrorDetail } from "@/lib/logger";
import { buildPasswordResetEmailTemplate, sendPlatformEmail } from "@/lib/notifications";
import { resolvePublicAppUrl } from "@/lib/public-app-url";
import { prisma } from "@/lib/prisma";
import { rateLimit, tooManyRequestsResponse } from "@/lib/rate-limit";
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

    // 3 resets/h por email — evita spam.
    const rl = await rateLimit("auth.password_forgot", email, "3/h");
    if (!rl.success) return tooManyRequestsResponse(rl) as unknown as NextResponse;

    const emailConfigured = Boolean(process.env.RESEND_API_KEY && process.env.RESEND_FROM_EMAIL);

    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, authProvider: true, fullName: true }
    });
    if (!user || user.authProvider !== "EMAIL") {
      return NextResponse.json({ ok: true, emailConfigured }, { status: 200 });
    }

    const token = randomToken(24);
    await prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash: sha256(token),
        expiresAt: new Date(Date.now() + 1000 * 60 * 30)
      }
    });

    if (!emailConfigured) {
      return NextResponse.json(
        {
          ok: true,
          emailConfigured: false,
          tokenPreview: process.env.NODE_ENV !== "production" ? token : undefined
        },
        { status: 200 }
      );
    }

    const appUrl = resolvePublicAppUrl(req);
    const resetUrl = `${appUrl}/restablecer-contrasena?token=${encodeURIComponent(token)}`;

    await sendPlatformEmail({
      to: email,
      subject: "Restablece tu contraseña en WeTask",
      text: `Hola ${user.fullName}. Usa este enlace para restablecer tu contraseña en WeTask: ${resetUrl}. Este enlace vence en 30 minutos.`,
      html: buildPasswordResetEmailTemplate({
        fullName: user.fullName,
        resetUrl,
        appUrl
      })
    });

    return NextResponse.json(
      {
        ok: true,
        emailConfigured: true,
        tokenPreview: process.env.NODE_ENV !== "production" ? token : undefined
      },
      { status: 200 }
    );
  } catch (error) {
    return NextResponse.json({ error: "No se pudo crear recuperacion", detail: safeErrorDetail(error) }, { status: 400 });
  }
}
