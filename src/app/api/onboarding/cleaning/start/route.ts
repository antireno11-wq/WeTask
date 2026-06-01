import { AuthProvider, CleaningOnboardingStatus, UserRole } from "@prisma/client";
import { safeErrorDetail } from "@/lib/logger";
import { NextRequest, NextResponse } from "next/server";
import { encodeSessionCookie, SESSION_COOKIE_NAME } from "@/lib/auth";
import { normalizeCommune } from "@/lib/communes";
import { prisma } from "@/lib/prisma";
import { getClientIp, rateLimit, tooManyRequestsResponse } from "@/lib/rate-limit";
import { cleaningOnboardingStartSchema } from "@/lib/validators";
import { hashPassword, randomToken, sha256 } from "@/lib/security";
import { getCurrentTermsVersionId } from "@/lib/terms-version";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    // PRO-10: limita la creación masiva de cuentas PRO por IP.
    const rl = await rateLimit("onboarding.start", getClientIp(req), "5/h");
    if (!rl.success) return tooManyRequestsResponse(rl) as unknown as NextResponse;

    const body = await req.json();
    const input = cleaningOnboardingStartSchema.parse(body);
    const baseCommune = normalizeCommune(input.baseCommune) ?? input.baseCommune.trim();

    const email = input.email.trim().toLowerCase();
    const exists = await prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (exists) {
      return NextResponse.json({ error: "Ese email ya esta registrado. Ingresa con tu cuenta existente." }, { status: 409 });
    }

    const provider: AuthProvider = input.authProvider;
    if (provider === "EMAIL" && (!input.password || input.password.trim().length < 8)) {
      return NextResponse.json({ error: "Debes crear una contraseña de al menos 8 caracteres." }, { status: 400 });
    }
    const passwordHash = provider === "EMAIL" ? await hashPassword(input.password ?? randomToken(12)) : null;
    const phone = input.phone.trim();
    const termsVersionId = input.acceptTerms ? await getCurrentTermsVersionId() : null;

    const user = await prisma.user.create({
      data: {
        fullName: input.fullName.trim(),
        phone,
        email,
        role: UserRole.PRO,
        authProvider: provider,
        passwordHash,
        termsAcceptedAt: input.acceptTerms ? new Date() : null,
        termsVersionId: termsVersionId ?? undefined,
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
        cleaningOnboarding: {
          create: {
            status: CleaningOnboardingStatus.BORRADOR,
            currentStep: 4,
            categorySlug: input.categorySlug?.trim() || "limpieza",
            baseCommune,
            referenceAddress: input.referenceAddress?.trim() || null,
            documentId: input.documentId?.trim() || null,
            profilePhotoUrl: input.profilePhotoUrl ?? null,
            profilePhotoPositionX: input.profilePhotoPositionX,
            profilePhotoPositionY: input.profilePhotoPositionY,
            serviceCommunes: [baseCommune],
            // El teléfono se da por válido al ingresarlo (sin verificación SMS).
            phoneValidatedAt: phone ? new Date() : null
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
            currentStep: true,
            phoneValidatedAt: true
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
        detail: safeErrorDetail(error)
      },
      { status: 400 }
    );
  }
}
