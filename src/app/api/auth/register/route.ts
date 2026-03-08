import { UserRole } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { encodeSessionCookie, SESSION_COOKIE_NAME } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hashPassword, randomToken, sha256 } from "@/lib/security";

export const dynamic = "force-dynamic";

type RegisterPayload = {
  fullName?: string;
  email?: string;
  password?: string;
  phone?: string;
  role?: "CUSTOMER" | "PRO";
  authProvider?: "EMAIL" | "GOOGLE" | "APPLE";
  acceptTerms?: boolean;
  coverageStreet?: string;
  coverageComuna?: string;
  city?: string;
  postalCode?: string;
  latitude?: number;
  longitude?: number;
  serviceRadiusKm?: number;
  hourlyRateFromClp?: number;
  documentType?: "CEDULA_CHILE" | "PASAPORTE";
  documentNumber?: string;
  identityDocumentUrl?: string;
  backgroundCheckUrl?: string;
};

function isValidDocumentRef(value: string) {
  return /^https?:\/\/\S+$/i.test(value) || value.startsWith("data:");
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as RegisterPayload;

    const fullName = body.fullName?.trim();
    const email = body.email?.trim().toLowerCase();
    const role = body.role === "PRO" ? UserRole.PRO : UserRole.CUSTOMER;
    const authProvider = body.authProvider === "GOOGLE" ? "GOOGLE" : body.authProvider === "APPLE" ? "APPLE" : "EMAIL";
    const password = body.password?.trim();
    const acceptTerms = body.acceptTerms === true;

    if (!fullName || fullName.length < 3) {
      return NextResponse.json({ error: "Nombre debe tener al menos 3 caracteres" }, { status: 400 });
    }

    if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
      return NextResponse.json({ error: "Email invalido" }, { status: 400 });
    }

    if (!acceptTerms) {
      return NextResponse.json({ error: "Debes aceptar terminos y condiciones" }, { status: 400 });
    }

    if (authProvider === "EMAIL" && (!password || password.length < 8)) {
      return NextResponse.json({ error: "La contraseña debe tener al menos 8 caracteres" }, { status: 400 });
    }

    if (role === UserRole.PRO) {
      const documentType = body.documentType === "PASAPORTE" ? "PASAPORTE" : body.documentType === "CEDULA_CHILE" ? "CEDULA_CHILE" : null;
      const documentNumber = body.documentNumber?.trim();
      const identityDocumentUrl = body.identityDocumentUrl?.trim();
      const backgroundCheckUrl = body.backgroundCheckUrl?.trim();

      if (!documentType) {
        return NextResponse.json({ error: "Debes seleccionar tipo de documento" }, { status: 400 });
      }
      if (!documentNumber || documentNumber.length < 5) {
        return NextResponse.json({ error: "Numero de documento invalido" }, { status: 400 });
      }
      if (!identityDocumentUrl || !isValidDocumentRef(identityDocumentUrl)) {
        return NextResponse.json({ error: "Debes adjuntar documento de identidad" }, { status: 400 });
      }
      if (!backgroundCheckUrl || !isValidDocumentRef(backgroundCheckUrl)) {
        return NextResponse.json({ error: "Debes adjuntar certificado de antecedentes" }, { status: 400 });
      }
    }

    const exists = await prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (exists) {
      return NextResponse.json({ error: "Ese email ya esta registrado" }, { status: 409 });
    }

    const passwordHash = authProvider === "EMAIL" && password ? await hashPassword(password) : null;

    const user = await prisma.user.create({
      data: {
        fullName,
        email,
        phone: body.phone?.trim() || null,
        role,
        authProvider,
        passwordHash,
        termsAcceptedAt: new Date(),
        emailVerifiedAt: authProvider === "EMAIL" ? null : new Date(),
        roleAssignments: {
          create: {
            role: {
              connectOrCreate: {
                where: { code: role },
                create: { code: role, label: role === UserRole.PRO ? "Tasker" : role === UserRole.ADMIN ? "Admin" : "Cliente" }
              }
            }
          }
        },
        professionalProfile:
          role === UserRole.PRO
            ? {
                create: {
                  isVerified: false,
                  verificationStatus: "PENDING_REVIEW",
                  idDocumentType: body.documentType?.trim() || null,
                  idDocumentNumber: body.documentNumber?.trim() || null,
                  idDocumentUrl: body.identityDocumentUrl?.trim() || null,
                  backgroundCheckUrl: body.backgroundCheckUrl?.trim() || null,
                  coverageStreet: body.coverageStreet?.trim() || null,
                  coverageComuna: body.coverageComuna?.trim() || null,
                  coverageCity: body.city?.trim() || "Santiago",
                  coveragePostal: body.postalCode?.trim() || null,
                  coverageLatitude: typeof body.latitude === "number" ? body.latitude : null,
                  coverageLongitude: typeof body.longitude === "number" ? body.longitude : null,
                  serviceRadiusKm: Math.max(2, Math.min(50, Number(body.serviceRadiusKm ?? 8))),
                  hourlyRateFromClp: body.hourlyRateFromClp ? Math.max(5000, Number(body.hourlyRateFromClp)) : null
                }
              }
            : undefined
      },
      select: { id: true, fullName: true, email: true, role: true }
    });

    let emailVerificationToken: string | null = null;
    if (authProvider === "EMAIL") {
      emailVerificationToken = randomToken(24);
      await prisma.emailVerificationToken.create({
        data: {
          userId: user.id,
          tokenHash: sha256(emailVerificationToken),
          expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24)
        }
      });
    }

    const shouldCreateSession = authProvider !== "EMAIL";
    const response = NextResponse.json(
      {
        session: shouldCreateSession
          ? {
              userId: user.id,
              fullName: user.fullName,
              email: user.email,
              role: user.role
            }
          : null,
        emailVerificationRequired: authProvider === "EMAIL",
        verificationTokenPreview:
          process.env.NODE_ENV !== "production" && emailVerificationToken ? emailVerificationToken : undefined
      },
      { status: 201 }
    );

    if (shouldCreateSession) {
      response.cookies.set({
        name: SESSION_COOKIE_NAME,
        value: encodeSessionCookie({ userId: user.id, role: user.role, email: user.email, fullName: user.fullName }),
        path: "/",
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        maxAge: 60 * 60 * 24 * 7
      });
    }

    return response;
  } catch (error) {
    return NextResponse.json(
      {
        error: "No se pudo registrar usuario",
        detail: error instanceof Error ? error.message : "Error desconocido"
      },
      { status: 400 }
    );
  }
}
