import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { randomToken, sha256 } from "@/lib/security";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { email?: string };
    const email = body.email?.trim().toLowerCase();
    if (!email) return NextResponse.json({ error: "Email requerido" }, { status: 400 });

    const user = await prisma.user.findUnique({ where: { email }, select: { id: true, authProvider: true } });
    if (!user || user.authProvider !== "EMAIL") {
      return NextResponse.json({ ok: true }, { status: 200 });
    }

    const token = randomToken(24);
    await prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash: sha256(token),
        expiresAt: new Date(Date.now() + 1000 * 60 * 30)
      }
    });

    return NextResponse.json(
      {
        ok: true,
        tokenPreview: process.env.NODE_ENV !== "production" ? token : undefined
      },
      { status: 200 }
    );
  } catch (error) {
    return NextResponse.json({ error: "No se pudo crear recuperacion", detail: error instanceof Error ? error.message : "Error desconocido" }, { status: 400 });
  }
}
