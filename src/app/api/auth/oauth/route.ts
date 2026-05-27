import { UserRole } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { encodeSessionCookie, SESSION_COOKIE_NAME } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { resolveLoginRole } from "@/lib/user-roles";
import { verifyOAuthToken } from "@/lib/oauth-verifier";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      provider?: "GOOGLE" | "APPLE";
      idToken?: string;
      email?: string;
      fullName?: string;
      role?: "CUSTOMER" | "PRO";
      acceptTerms?: boolean;
    };

    const provider = body.provider === "APPLE" ? "APPLE" : body.provider === "GOOGLE" ? "GOOGLE" : null;
    const role = body.role === "PRO" ? UserRole.PRO : UserRole.CUSTOMER;

    if (!provider) {
      return NextResponse.json({ error: "provider es requerido (GOOGLE o APPLE)" }, { status: 400 });
    }

    if (!body.acceptTerms) {
      return NextResponse.json({ error: "Debes aceptar términos y condiciones" }, { status: 400 });
    }

    let email = body.email?.trim().toLowerCase();
    let fullName = body.fullName?.trim();

    const isProduction = process.env.NODE_ENV === "production";

    if (body.idToken) {
      // Verify token cryptographically
      try {
        const verified = await verifyOAuthToken(provider, body.idToken);
        email = verified.email;
        fullName = verified.fullName;
      } catch (verificationError) {
        return NextResponse.json(
          {
            error: "Token de autenticación inválido",
            detail: verificationError instanceof Error ? verificationError.message : "Error de verificación"
          },
          { status: 401 }
        );
      }
    } else {
      // No token provided. Enforce it in production.
      if (isProduction) {
        return NextResponse.json(
          { error: "idToken es requerido en el entorno de producción para autenticación OAuth" },
          { status: 400 }
        );
      }
      // Local dev fallback
      if (!email || !fullName) {
        return NextResponse.json(
          { error: "idToken (o email y fullName en desarrollo) son requeridos" },
          { status: 400 }
        );
      }
      console.warn(`[oauth] Insecure dev fallback used for ${email}. Configure GOOGLE_CLIENT_ID/APPLE_CLIENT_ID for full verification.`);
    }

    const user = await prisma.user.upsert({
      where: { email },
      update: {
        fullName,
        authProvider: provider,
        termsAcceptedAt: new Date(),
        emailVerifiedAt: new Date()
      },
      create: {
        email,
        fullName,
        role,
        authProvider: provider,
        termsAcceptedAt: new Date(),
        emailVerifiedAt: new Date(),
        roleAssignments: {
          create: {
            role: {
              connectOrCreate: {
                where: { code: role },
                create: { code: role, label: role === UserRole.PRO ? "Tasker" : "Cliente" }
              }
            }
          }
        }
      },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        roleAssignments: { select: { role: { select: { code: true } } } }
      }
    });

    const dbRole = await prisma.role.upsert({
      where: { code: role },
      update: { label: role === UserRole.PRO ? "Tasker" : "Cliente" },
      create: { code: role, label: role === UserRole.PRO ? "Tasker" : "Cliente" }
    });

    await prisma.userRoleAssignment.upsert({
      where: {
        userId_roleId: {
          userId: user.id,
          roleId: dbRole.id
        }
      },
      update: {},
      create: {
        userId: user.id,
        roleId: dbRole.id
      }
    });

    const sessionRole = resolveLoginRole(user, role);
    const response = NextResponse.json({ session: { ...user, role: sessionRole } }, { status: 200 });
    response.cookies.set({
      name: SESSION_COOKIE_NAME,
      value: encodeSessionCookie({ userId: user.id, role: sessionRole, email: user.email, fullName: user.fullName }),
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      secure: isProduction,
      maxAge: 60 * 60 * 24 * 7
    });

    return response;
  } catch (error) {
    return NextResponse.json({ error: "No se pudo autenticar con proveedor", detail: error instanceof Error ? error.message : "Error desconocido" }, { status: 400 });
  }
}

