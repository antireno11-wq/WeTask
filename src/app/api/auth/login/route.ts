import { UserRole } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { ensureMarketplaceDemoData } from "@/lib/marketplace-demo-data";
import { encodeSessionCookie, SESSION_COOKIE_NAME } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    await ensureMarketplaceDemoData();

    const body = (await req.json()) as { userId?: string; email?: string; role?: UserRole };

    if (!body.userId && !body.email) {
      return NextResponse.json({ error: "Debes enviar userId o email" }, { status: 400 });
    }

    const user = body.userId
      ? await prisma.user.findUnique({ where: { id: body.userId }, select: { id: true, email: true, fullName: true, role: true } })
      : await prisma.user.findUnique({
          where: { email: body.email! },
          select: { id: true, email: true, fullName: true, role: true }
        });

    if (!user) {
      return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
    }

    if (body.role && body.role !== user.role) {
      return NextResponse.json({ error: "El rol no coincide con el usuario" }, { status: 400 });
    }

    const response = NextResponse.json(
      {
        session: {
          userId: user.id,
          email: user.email,
          fullName: user.fullName,
          role: user.role
        }
      },
      { status: 200 }
    );

    response.cookies.set({
      name: SESSION_COOKIE_NAME,
      value: encodeSessionCookie({ userId: user.id, role: user.role, email: user.email, fullName: user.fullName }),
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24 * 7
    });

    return response;
  } catch (error) {
    return NextResponse.json(
      {
        error: "No se pudo iniciar sesion",
        detail: error instanceof Error ? error.message : "Error desconocido"
      },
      { status: 400 }
    );
  }
}
