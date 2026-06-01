import { UserRole } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { encodeSessionCookie, SESSION_COOKIE_NAME } from "@/lib/auth";
import { normalizeCommune } from "@/lib/communes";
import { safeErrorDetail } from "@/lib/logger";
import { buildVerificationEmailTemplate, sendPlatformEmail } from "@/lib/notifications";
import { prisma } from "@/lib/prisma";
import { resolvePublicAppUrl } from "@/lib/public-app-url";
import { getClientIp, rateLimit, tooManyRequestsResponse } from "@/lib/rate-limit";
import { hashPassword, randomToken, sha256 } from "@/lib/security";
import { verifyPassword } from "@/lib/security";
import { getCurrentTermsVersionId } from "@/lib/terms-version";
import { hasAssignedRole, resolveLoginRole } from "@/lib/user-roles";

export const dynamic = "force-dynamic";

function createEmailVerificationCode() {
  return randomToken(6).replace(/[^0-9]/g, "").slice(0, 6).padEnd(6, "0");
}

type RegisterPayload = {
  fullName?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  password?: string;
  birthDate?: string;
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
    // AUTH-06: limita registro masivo / enumeración por IP.
    const rl = await rateLimit("auth.register", getClientIp(req), "10/h");
    if (!rl.success) return tooManyRequestsResponse(rl) as unknown as NextResponse;

    const body = (await req.json()) as RegisterPayload;

    const firstName = body.firstName?.trim();
    const lastName = body.lastName?.trim();
    const fullName = body.fullName?.trim() || [firstName, lastName].filter(Boolean).join(" ").trim();
    const email = body.email?.trim().toLowerCase();
    const role = body.role === "PRO" ? UserRole.PRO : UserRole.CUSTOMER;
    const authProvider = body.authProvider === "GOOGLE" ? "GOOGLE" : body.authProvider === "APPLE" ? "APPLE" : "EMAIL";
    const password = body.password?.trim();
    const acceptTerms = body.acceptTerms === true;
    const birthDate =
      role === UserRole.CUSTOMER && body.birthDate?.trim()
        ? new Date(`${body.birthDate.trim()}T00:00:00.000Z`)
        : null;
    const normalizedCoverageCommune = role === UserRole.PRO ? normalizeCommune(body.coverageComuna) : null;

    if (!fullName || fullName.length < 3) {
      return NextResponse.json({ error: "Nombre debe tener al menos 3 caracteres" }, { status: 400 });
    }

    if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
      return NextResponse.json({ error: "Email inválido" }, { status: 400 });
    }

    if (role === UserRole.CUSTOMER) {
      if (!firstName || firstName.length < 2) {
        return NextResponse.json({ error: "Nombre debe tener al menos 2 caracteres" }, { status: 400 });
      }
      if (!lastName || lastName.length < 2) {
        return NextResponse.json({ error: "Apellido debe tener al menos 2 caracteres" }, { status: 400 });
      }
      if (!birthDate || Number.isNaN(birthDate.getTime()) || birthDate > new Date()) {
        return NextResponse.json({ error: "Fecha de nacimiento inválida" }, { status: 400 });
      }
    }

    if (!acceptTerms) {
      return NextResponse.json({ error: "Debes aceptar términos y condiciones" }, { status: 400 });
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
        return NextResponse.json({ error: "Número de documento inválido" }, { status: 400 });
      }
      if (!identityDocumentUrl || !isValidDocumentRef(identityDocumentUrl)) {
        return NextResponse.json({ error: "Debes adjuntar documento de identidad" }, { status: 400 });
      }
      if (!backgroundCheckUrl || !isValidDocumentRef(backgroundCheckUrl)) {
        return NextResponse.json({ error: "Debes adjuntar certificado de antecedentes" }, { status: 400 });
      }
      if (!normalizedCoverageCommune) {
        return NextResponse.json(
          { error: "Aún no estamos disponibles en tu comuna. Déjanos tu email y te avisaremos cuando lleguemos." },
          { status: 400 }
        );
      }
    }

    const existingUser = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        fullName: true,
        email: true,
        phone: true,
        role: true,
        authProvider: true,
        passwordHash: true,
        emailVerifiedAt: true,
        roleAssignments: { select: { role: { select: { code: true } } } }
      }
    });

    const passwordHash = authProvider === "EMAIL" && password ? await hashPassword(password) : null;
    const roleRecord = await prisma.role.upsert({
      where: { code: role },
      update: { label: role === UserRole.PRO ? "Tasker" : "Cliente" },
      create: { code: role, label: role === UserRole.PRO ? "Tasker" : "Cliente" }
    });

    let user:
      | {
          id: string;
          fullName: string;
          email: string;
          role: UserRole;
          emailVerifiedAt?: Date | null;
          roleAssignments?: Array<{ role: { code: UserRole } }>;
        }
      | null = null;

    const termsVersionId = await getCurrentTermsVersionId();

    if (existingUser) {
      if (authProvider === "EMAIL") {
        if (existingUser.authProvider !== "EMAIL" || !existingUser.passwordHash || !password) {
          return NextResponse.json(
            { error: "Ese correo ya existe. Ingresa con ese acceso para usar también tu cuenta cliente." },
            { status: 409 }
          );
        }

        const passwordMatches = await verifyPassword(password, existingUser.passwordHash);
        if (!passwordMatches) {
          return NextResponse.json(
            { error: "Ese correo ya existe. Usa la misma contraseña de tu cuenta actual para activar cliente." },
            { status: 409 }
          );
        }
      }

      if (!hasAssignedRole(existingUser, role)) {
        await prisma.userRoleAssignment.upsert({
          where: {
            userId_roleId: {
              userId: existingUser.id,
              roleId: roleRecord.id
            }
          },
          update: {},
          create: {
            userId: existingUser.id,
            roleId: roleRecord.id
          }
        });
      }

      user = await prisma.user.update({
        where: { id: existingUser.id },
        data: {
          fullName,
          phone: body.phone?.trim() || existingUser.phone || null,
          termsAcceptedAt: new Date(),
          termsVersionId: termsVersionId ?? undefined
        },
        select: {
          id: true,
          fullName: true,
          email: true,
          role: true,
          emailVerifiedAt: true,
          roleAssignments: { select: { role: { select: { code: true } } } }
        }
      });
    } else {
      user = await prisma.user.create({
      data: {
        fullName,
        email,
        phone: body.phone?.trim() || null,
        birthDate,
        role,
        authProvider,
        passwordHash,
        termsAcceptedAt: new Date(),
        termsVersionId: termsVersionId ?? undefined,
        emailVerifiedAt: authProvider === "EMAIL" ? null : new Date(),
        roleAssignments: {
          create: {
            role: {
              connect: { id: roleRecord.id }
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
                  coverageComuna: normalizedCoverageCommune,
                  coverageCity: body.city?.trim() || "Santiago",
                  coveragePostal: body.postalCode?.trim() || null,
                  coverageLatitude: typeof body.latitude === "number" ? body.latitude : null,
                  coverageLongitude: typeof body.longitude === "number" ? body.longitude : null,
                  serviceRadiusKm: Math.max(2, Math.min(50, Number(body.serviceRadiusKm ?? 8))),
                  hourlyRateFromClp: body.hourlyRateFromClp ? Math.max(5000, Number(body.hourlyRateFromClp)) : null
                }
              }
            : undefined,
        cleaningOnboarding:
          role === UserRole.PRO
            ? {
                create: {
                  currentStep: 2,
                  baseCommune: normalizedCoverageCommune,
                  serviceCommunes: normalizedCoverageCommune ? [normalizedCoverageCommune] : []
                }
              }
            : undefined
      },
      select: {
        id: true,
        fullName: true,
        email: true,
        role: true,
        emailVerifiedAt: true,
        roleAssignments: { select: { role: { select: { code: true } } } }
      }
      });
    }

    let emailVerificationToken: string | null = null;
    let emailDeliveryConfigured = true;
    const requiresEmailVerification = authProvider === "EMAIL" && !user.emailVerifiedAt;

    if (requiresEmailVerification) {
      const appUrl = resolvePublicAppUrl(req);
      emailVerificationToken = createEmailVerificationCode();
      await prisma.emailVerificationToken.create({
        data: {
          userId: user.id,
          tokenHash: sha256(emailVerificationToken),
          expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24)
        }
      });

      emailDeliveryConfigured = Boolean(process.env.RESEND_API_KEY && process.env.RESEND_FROM_EMAIL);
      if (emailDeliveryConfigured) {
        const verifyUrl = new URL("/verificar-correo", appUrl);
        verifyUrl.searchParams.set("token", emailVerificationToken);
        const html = buildVerificationEmailTemplate({
          fullName: user.fullName,
          verifyUrl: verifyUrl.toString(),
          code: emailVerificationToken,
          appUrl
        });

        await sendPlatformEmail({
          to: user.email,
          subject: "Verifica tu cuenta de WeTask",
          text:
            `Hola ${user.fullName},\n\n` +
            `Tu código de verificación de WeTask es: ${emailVerificationToken}\n\n` +
            `También puedes verificar tu cuenta entrando a este link:\n${verifyUrl.toString()}\n\n` +
            `Si no creaste esta cuenta, ignora este correo.\n\nEquipo WeTask`,
          html
        });
      }
    }

    const shouldCreateSession = !requiresEmailVerification;
    const sessionRole = resolveLoginRole(user, role);
    const response = NextResponse.json(
      {
        session: shouldCreateSession
          ? {
              userId: user.id,
              fullName: user.fullName,
              email: user.email,
              role: sessionRole
            }
          : null,
        emailVerificationRequired: requiresEmailVerification,
        emailDeliveryConfigured,
        verificationTokenPreview:
          process.env.NODE_ENV !== "production" && emailVerificationToken ? emailVerificationToken : undefined
      },
      { status: 201 }
    );

    if (shouldCreateSession) {
      response.cookies.set({
        name: SESSION_COOKIE_NAME,
        value: encodeSessionCookie({ userId: user.id, role: sessionRole, email: user.email, fullName: user.fullName }),
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
        detail: safeErrorDetail(error)
      },
      { status: 400 }
    );
  }
}
