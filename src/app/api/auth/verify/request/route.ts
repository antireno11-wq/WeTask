import { NextRequest, NextResponse } from "next/server";
import { sendPlatformEmail } from "@/lib/notifications";
import { prisma } from "@/lib/prisma";
import { randomToken, sha256 } from "@/lib/security";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { email?: string };
    const email = body.email?.trim().toLowerCase();
    if (!email) return NextResponse.json({ error: "Email requerido" }, { status: 400 });

    const user = await prisma.user.findUnique({ where: { email }, select: { id: true, authProvider: true, emailVerifiedAt: true } });
    if (!user) return NextResponse.json({ ok: true }, { status: 200 });
    if (user.authProvider !== "EMAIL") return NextResponse.json({ ok: true }, { status: 200 });
    if (user.emailVerifiedAt) return NextResponse.json({ ok: true, alreadyVerified: true }, { status: 200 });

    const code = randomToken(6).replace(/[^0-9]/g, "").slice(0, 6).padEnd(6, "0");
    await prisma.emailVerificationToken.create({
      data: {
        userId: user.id,
        tokenHash: sha256(code),
        expiresAt: new Date(Date.now() + 1000 * 60 * 10)
      }
    });

    await sendPlatformEmail({
      to: email,
      subject: "Tu codigo de verificacion WeTask",
      text: `Tu codigo de verificacion es ${code}. Expira en 10 minutos.`
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
    return NextResponse.json({ error: "No se pudo generar verificacion", detail: error instanceof Error ? error.message : "Error desconocido" }, { status: 400 });
  }
}
