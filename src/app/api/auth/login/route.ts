import { UserRole } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { ensureMarketplaceDemoData } from "@/lib/marketplace-demo-data";
import { encodeSessionCookie, SESSION_COOKIE_NAME } from "@/lib/auth";
import { ensurePrimaryAdminUser } from "@/lib/primary-admin";
import { prisma } from "@/lib/prisma";
import { getClientIp, rateLimit, tooManyRequestsResponse } from "@/lib/rate-limit";
import { verifyPassword } from "@/lib/security";
import { hasAssignedRole, resolveLoginRole } from "@/lib/user-roles";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    await ensureMarketplaceDemoData();
    await ensurePrimaryAdminUser();

    const body = (await req.json()) as { email?: string; password?: string; role?: UserRole };

    // AUTH-01: el login SIEMPRE exige email + contraseña (o token OAuth en su propio endpoint).
    // Se eliminó el camino de login por `userId`, que emitía sesión sin prueba de identidad.
    if (!body.email) {
      return NextResponse.json({ error: "Debes ingresar email y contraseña" }, { status: 400 });
    }

    // Rate limit: 5 intentos/min por (IP + email) — protege contra brute force.
    const ip = getClientIp(req);
    const identifier = `${ip}:${body.email}`;
    const rl = await rateLimit("auth.login", identifier, "5/m");
    if (!rl.success) return tooManyRequestsResponse(rl) as unknown as NextResponse;

    const user = await prisma.user.findUnique({
      where: { email: body.email },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        passwordHash: true,
        authProvider: true,
        emailVerifiedAt: true,
        sessionVersion: true,
        roleAssignments: { select: { role: { select: { code: true } } } }
      }
    });

    // AUTH-07: respuesta única para "no existe" y "credenciales inválidas" (evita enumeración).
    const invalidCredentials = () =>
      NextResponse.json({ error: "Credenciales inválidas" }, { status: 401 });

    if (!user) {
      // Igualamos el costo: ejecutamos un verify dummy para no filtrar por timing.
      await verifyPassword(body.password ?? "", "$2a$12$0000000000000000000000000000000000000000000000000000");
      return invalidCredentials();
    }

    const requestedRole = body.role ?? user.role;
    const canLoginAsRequestedRole = hasAssignedRole(user, requestedRole);
    const effectiveRequestedRole =
      canLoginAsRequestedRole || requestedRole === UserRole.ADMIN ? requestedRole : user.role;
    const canBypassEmailVerification = hasAssignedRole(user, effectiveRequestedRole) && effectiveRequestedRole === UserRole.ADMIN;

    if (requestedRole === UserRole.ADMIN && !canLoginAsRequestedRole) {
      return invalidCredentials();
    }

    if (user.authProvider === "EMAIL") {
      if (!body.password || !user.passwordHash) {
        return NextResponse.json({ error: "Debes ingresar email y contraseña" }, { status: 400 });
      }
      const ok = await verifyPassword(body.password, user.passwordHash);
      if (!ok) {
        return invalidCredentials();
      }
    }

    if (!user.emailVerifiedAt && !canBypassEmailVerification) {
      return NextResponse.json({ error: "Debes verificar tu correo antes de ingresar" }, { status: 403 });
    }

    const sessionRole = resolveLoginRole(user, effectiveRequestedRole);

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
      value: encodeSessionCookie({ userId: user.id, role: sessionRole, email: user.email, fullName: user.fullName, sessionVersion: user.sessionVersion }),
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
