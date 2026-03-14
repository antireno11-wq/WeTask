import { AuthProvider, CleaningOnboardingStatus, UserRole } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { encodeSessionCookie, SESSION_COOKIE_NAME } from "@/lib/auth";
import { normalizeCommune } from "@/lib/communes";
import { decodeVerifiedPhone, PUBLIC_ONBOARDING_PHONE_VERIFIED_COOKIE } from "@/lib/onboarding-phone";
import { prisma } from "@/lib/prisma";
import { cleaningOnboardingStartSchema } from "@/lib/validators";
import { hashPassword, randomToken, sha256 } from "@/lib/security";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const input = cleaningOnboardingStartSchema.parse(body);
    const baseCommune = normalizeCommune(input.baseCommune) ?? input.baseCommune.trim();

    const email = input.email.trim().toLowerCase();
    const exists = await prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (exists) {
      return NextResponse.json({ error: "Ese email ya esta registrado. Ingresa con tu cuenta existente." }, { status: 409 });
    }

    const provider: AuthProvider = input.authProvider;
    const passwordHash = provider === "EMAIL" ? await hashPassword(input.password ?? randomToken(12)) : null;
    const verifiedPhone = decodeVerifiedPhone(req.cookies.get(PUBLIC_ONBOARDING_PHONE_VERIFIED_COOKIE)?.value);
    const phone = input.phone.trim();
    const phoneIsVerified = verifiedPhone?.verified === true && verifiedPhone.phone.trim() === phone;

    const user = await prisma.user.create({
      data: {
        fullName: input.fullName.trim(),
        phone,
        email,
        role: UserRole.PRO,
        authProvider: provider,
        passwordHash,
        termsAcceptedAt: input.acceptTerms ? new Date() : null,
        emailVerifiedAt: provider === "EMAIL" ? null : new Date(),
        roleAssignments: {
          create: {
            role: {
              connectOrCreate: {
                where: { code: UserRole.PRO },
                create: { code: UserRole.PRO, label: "Tasker" }
              }
            }
          }
        },
        professionalProfile: {
          create: {
            isVerified: false,
            verificationStatus: "PENDING_REVIEW",
            coverageComuna: baseCommune,
            coverageCity: "Santiago",
            serviceRadiusKm: 8
          }
        },
        cleaningOnboarding: {
          create: {
            status: CleaningOnboardingStatus.BORRADOR,
            currentStep: 4,
            categorySlug: input.categorySlug?.trim() || "limpieza",
            baseCommune,
            referenceAddress: input.referenceAddress?.trim() || null,
            documentId: input.documentId?.trim() || null,
            profilePhotoUrl: input.profilePhotoUrl ?? null,
            serviceCommunes: [baseCommune],
            phoneValidatedAt: phoneIsVerified ? new Date() : null
          }
        }
      },
      select: {
        id: true,
        fullName: true,
        email: true,
        role: true,
        cleaningOnboarding: {
          select: {
            id: true,
            status: true,
            currentStep: true
          }
        }
      }
    });

    let verificationTokenPreview: string | undefined;
    if (provider === "EMAIL") {
      const rawToken = randomToken(24);
      await prisma.emailVerificationToken.create({
        data: {
          userId: user.id,
          tokenHash: sha256(rawToken),
          expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24)
        }
      });
      if (process.env.NODE_ENV !== "production") {
        verificationTokenPreview = rawToken;
      }
    }

    const response = NextResponse.json(
      {
        ok: true,
        session: {
          userId: user.id,
          fullName: user.fullName,
          email: user.email,
          role: user.role
        },
        onboarding: user.cleaningOnboarding,
        emailVerificationRequired: provider === "EMAIL",
        verificationTokenPreview
      },
      { status: 201 }
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
        error: "No se pudo iniciar onboarding",
        detail: error instanceof Error ? error.message : "Error desconocido"
      },
      { status: 400 }
    );
  }
}
