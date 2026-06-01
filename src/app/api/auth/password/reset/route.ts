import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword, sha256 } from "@/lib/security";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { token?: string; newPassword?: string };
    const token = body.token?.trim();
    const newPassword = body.newPassword?.trim();

    if (!token || !newPassword || newPassword.length < 8) {
      return NextResponse.json({ error: "Token y nueva contraseña (min 8) son requeridos" }, { status: 400 });
    }

    const now = new Date();
    const reset = await prisma.passwordResetToken.findFirst({
      where: {
        tokenHash: sha256(token),
        usedAt: null,
        expiresAt: { gt: now }
      },
      select: { id: true, userId: true }
    });

    if (!reset) {
      return NextResponse.json({ error: "Token inválido o expirado" }, { status: 400 });
    }

    const passwordHash = await hashPassword(newPassword);

    await prisma.$transaction([
      // AUTH-05: incrementa sessionVersion → invalida todas las cookies emitidas antes del reset.
      prisma.user.update({
        where: { id: reset.userId },
        data: { passwordHash, sessionVersion: { increment: 1 } }
      }),
      prisma.passwordResetToken.update({ where: { id: reset.id }, data: { usedAt: now } }),
      // AUTH-05: invalida cualquier otro token de reset pendiente del mismo usuario.
      prisma.passwordResetToken.updateMany({
        where: { userId: reset.userId, usedAt: null },
        data: { usedAt: now }
      })
    ]);

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    return NextResponse.json({ error: "No se pudo resetear contraseña", detail: error instanceof Error ? error.message : "Error desconocido" }, { status: 400 });
  }
}
