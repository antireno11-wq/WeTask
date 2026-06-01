import { UserRole } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { OAuth2Client, type TokenPayload } from "google-auth-library";
import { encodeSessionCookie, SESSION_COOKIE_NAME } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { verifyOAuthToken } from "@/lib/oauth-verifier";
import { getClientIp, rateLimit, tooManyRequestsResponse } from "@/lib/rate-limit";
import { getCurrentTermsVersionId } from "@/lib/terms-version";
import { resolveLoginRole } from "@/lib/user-roles";

export const dynamic = "force-dynamic";

type OAuthPayload = {
  provider?: "GOOGLE" | "APPLE";
  idToken?: string;
  email?: string;
  fullName?: string;
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
    const ip = getClientIp(req);
    const rl = await rateLimit("auth.oauth", ip, "10/m");
    if (!rl.success) return tooManyRequestsResponse(rl) as unknown as NextResponse;

    const body = (await req.json()) as OAuthPayload;
    const provider = body.provider === "APPLE" ? "APPLE" : body.provider === "GOOGLE" ? "GOOGLE" : null;
    const role = body.role === "PRO" ? UserRole.PRO : UserRole.CUSTOMER;
    const isProduction = process.env.NODE_ENV === "production";

    if (!provider) {
      return NextResponse.json({ error: "provider es requerido (GOOGLE o APPLE)" }, { status: 400 });
    }

    if (!body.acceptTerms) {
      return NextResponse.json({ error: "Debes aceptar términos y condiciones" }, { status: 400 });
    }

    let email = body.email?.trim().toLowerCase();
    let fullName = body.fullName?.trim();

    if (body.idToken) {
      if (provider === "GOOGLE") {
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

        email = claims.email.trim().toLowerCase();
        fullName = (claims.name || claims.given_name || email.split("@")[0]).trim();
      } else {
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
      }
    } else if (isProduction) {
      return NextResponse.json(
        { error: "idToken es requerido en el entorno de producción para autenticación OAuth" },
        { status: 400 }
      );
    } else if (!email || !fullName) {
      return NextResponse.json(
        { error: "idToken (o email y fullName en desarrollo) son requeridos" },
        { status: 400 }
      );
    } else {
      console.warn(
        `[oauth] Insecure dev fallback used for ${email}. Configure GOOGLE_OAUTH_CLIENT_ID for full verification.`
      );
    }

    if (!email || !fullName) {
      return NextResponse.json({ error: "No se pudo determinar el email del usuario" }, { status: 400 });
    }

    const termsVersionId = await getCurrentTermsVersionId();

    const user = await prisma.user.upsert({
      where: { email },
      update: {
        fullName,
        authProvider: provider,
        termsAcceptedAt: new Date(),
        termsVersionId: termsVersionId ?? undefined,
        emailVerifiedAt: new Date()
      },
      create: {
        email,
        fullName,
        role,
        authProvider: provider,
        termsAcceptedAt: new Date(),
        termsVersionId: termsVersionId ?? undefined,
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
        sessionVersion: true,
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
      value: encodeSessionCookie({ userId: user.id, role: sessionRole, email: user.email, fullName: user.fullName, sessionVersion: user.sessionVersion }),
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      secure: isProduction,
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
