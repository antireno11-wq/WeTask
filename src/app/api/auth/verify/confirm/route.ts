import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sha256 } from "@/lib/security";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { token?: string };
    const token = body.token?.trim();
    if (!token) return NextResponse.json({ error: "Token requerido" }, { status: 400 });

    const now = new Date();
    const record = await prisma.emailVerificationToken.findFirst({
      where: {
        tokenHash: sha256(token),
        usedAt: null,
        expiresAt: { gt: now }
      },
      select: { id: true, userId: true }
    });

    if (!record) {
      return NextResponse.json({ error: "Token invalido o expirado" }, { status: 400 });
    }

    await prisma.$transaction([
      prisma.user.update({ where: { id: record.userId }, data: { emailVerifiedAt: now } }),
      prisma.emailVerificationToken.update({ where: { id: record.id }, data: { usedAt: now } })
    ]);

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    return NextResponse.json({ error: "No se pudo verificar correo", detail: error instanceof Error ? error.message : "Error desconocido" }, { status: 400 });
  }
}
