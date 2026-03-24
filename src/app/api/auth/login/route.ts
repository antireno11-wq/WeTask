import { UserRole } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { ensureMarketplaceDemoData } from "@/lib/marketplace-demo-data";
import { encodeSessionCookie, SESSION_COOKIE_NAME } from "@/lib/auth";
import { ensurePrimaryAdminUser } from "@/lib/primary-admin";
import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/security";
import { hasAssignedRole, resolveLoginRole } from "@/lib/user-roles";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    await ensureMarketplaceDemoData();
    await ensurePrimaryAdminUser();

    const body = (await req.json()) as { userId?: string; email?: string; password?: string; role?: UserRole };

    if (!body.userId && !body.email) {
      return NextResponse.json({ error: "Debes enviar userId o email" }, { status: 400 });
    }

    const user = body.userId
      ? await prisma.user.findUnique({
          where: { id: body.userId },
          select: {
            id: true,
            email: true,
            fullName: true,
            role: true,
            passwordHash: true,
            authProvider: true,
            emailVerifiedAt: true,
            roleAssignments: { select: { role: { select: { code: true } } } }
          }
        })
      : await prisma.user.findUnique({
          where: { email: body.email! },
          select: {
            id: true,
            email: true,
            fullName: true,
            role: true,
            passwordHash: true,
            authProvider: true,
            emailVerifiedAt: true,
            roleAssignments: { select: { role: { select: { code: true } } } }
          }
        });

    if (!user) {
      return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
    }

    const requestedRole = body.role ?? user.role;
    const canLoginAsRequestedRole = hasAssignedRole(user, requestedRole);

    if (body.role && !canLoginAsRequestedRole) {
      return NextResponse.json({ error: "El rol no coincide con el usuario" }, { status: 400 });
    }

    if (!body.userId) {
      if (user.authProvider === "EMAIL") {
        if (!body.password || !user.passwordHash) {
          return NextResponse.json({ error: "Debes ingresar email y contraseña" }, { status: 400 });
        }
        const ok = await verifyPassword(body.password, user.passwordHash);
        if (!ok) {
          return NextResponse.json({ error: "Credenciales inválidas" }, { status: 401 });
        }
      }

      if (!user.emailVerifiedAt) {
        return NextResponse.json({ error: "Debes verificar tu correo antes de ingresar" }, { status: 403 });
      }
    }

    const sessionRole = resolveLoginRole(user, requestedRole);

    const response = NextResponse.json(
      {
        session: {
          userId: user.id,
          email: user.email,
          fullName: user.fullName,
          role: sessionRole
        }
      },
      { status: 200 }
    );

    response.cookies.set({
      name: SESSION_COOKIE_NAME,
      value: encodeSessionCookie({ userId: user.id, role: sessionRole, email: user.email, fullName: user.fullName }),
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
        error: "No se pudo iniciar sesión",
        detail: error instanceof Error ? error.message : "Error desconocido"
      },
      { status: 400 }
    );
  }
}
