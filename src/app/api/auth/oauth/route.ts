import { UserRole } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { OAuth2Client, type TokenPayload } from "google-auth-library";
import { encodeSessionCookie, SESSION_COOKIE_NAME } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { resolveLoginRole } from "@/lib/user-roles";

export const dynamic = "force-dynamic";

type OAuthPayload = {
  provider?: "GOOGLE" | "APPLE";
  idToken?: string;
  role?: "CUSTOMER" | "PRO";
  acceptTerms?: boolean;
};

async function verifyGoogleIdToken(idToken: string): Promise<TokenPayload | null> {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  if (!clientId) return null;
  try {
    const client = new OAuth2Client(clientId);
    const ticket = await client.verifyIdToken({ idToken, audience: clientId });
    return ticket.getPayload() ?? null;
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as OAuthPayload;
    const provider = body.provider === "APPLE" ? "APPLE" : body.provider === "GOOGLE" ? "GOOGLE" : null;
    const role = body.role === "PRO" ? UserRole.PRO : UserRole.CUSTOMER;

    if (!provider || !body.idToken) {
      return NextResponse.json({ error: "provider e idToken son requeridos" }, { status: 400 });
    }

    if (!body.acceptTerms) {
      return NextResponse.json({ error: "Debes aceptar términos y condiciones" }, { status: 400 });
    }

    if (provider === "APPLE") {
      return NextResponse.json(
        { error: "Inicio de sesión con Apple aún no está disponible" },
        { status: 501 }
      );
    }

    if (!process.env.GOOGLE_OAUTH_CLIENT_ID) {
      return NextResponse.json(
        { error: "OAuth no está configurado en el servidor" },
        { status: 503 }
      );
    }

    const claims = await verifyGoogleIdToken(body.idToken);
    if (!claims || !claims.email || claims.email_verified !== true) {
      return NextResponse.json({ error: "Token de Google inválido o email no verificado" }, { status: 401 });
    }

    const email = claims.email.trim().toLowerCase();
    const fullName = (claims.name || claims.given_name || email.split("@")[0]).trim();

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
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24 * 7
    });

    return response;
  } catch (error) {
    return NextResponse.json(
      { error: "No se pudo autenticar con proveedor", detail: error instanceof Error ? error.message : "Error desconocido" },
      { status: 400 }
    );
  }
}
