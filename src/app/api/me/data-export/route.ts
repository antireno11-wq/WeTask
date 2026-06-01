import { NextRequest, NextResponse } from "next/server";
import { getRequestIdentity } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getClientIp, rateLimit, tooManyRequestsResponse } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/**
 * Ley 19.628 (Chile) — derecho del titular a obtener una copia de sus
 * datos personales. Devolvemos un JSON con todos los datos asociados a la
 * cuenta autenticada. Rate-limit estricto: 3/h por IP para evitar abuso.
 */
export async function GET(req: NextRequest) {
  const identity = getRequestIdentity(req);
  if (!identity.userId) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const rl = await rateLimit("me.data_export", `${identity.userId}:${getClientIp(req)}`, "3/h");
  if (!rl.success) return tooManyRequestsResponse(rl) as unknown as NextResponse;

  const user = await prisma.user.findUnique({
    where: { id: identity.userId },
    select: {
      id: true,
      email: true,
      fullName: true,
      phone: true,
      birthDate: true,
      role: true,
      authProvider: true,
      termsAcceptedAt: true,
      termsVersionId: true,
      emailVerifiedAt: true,
      deletedAt: true,
      scheduledDeletionAt: true,
      createdAt: true,
      updatedAt: true,
      mpUserId: true,
      mpAccountStatus: true,
      mpConnectedAt: true,
      addresses: {
        select: {
          id: true,
          street: true,
          city: true,
          postalCode: true,
          region: true,
          country: true,
          createdAt: true
        }
      },
      paymentMethods: {
        select: {
          id: true,
          brand: true,
          last4: true,
          expirationMonth: true,
          expirationYear: true,
          isDefault: true,
          createdAt: true
        }
      },
      bookings: {
        select: {
          id: true,
          status: true,
          scheduledAt: true,
          addressLine1: true,
          comuna: true,
          totalPriceClp: true,
          paymentStatus: true,
          createdAt: true
        },
        orderBy: { createdAt: "desc" },
        take: 500
      },
      reviewsGiven: {
        select: { id: true, bookingId: true, rating: true, comment: true, createdAt: true },
        take: 500
      },
      notifications: {
        select: { id: true, title: true, body: true, isRead: true, createdAt: true },
        orderBy: { createdAt: "desc" },
        take: 500
      },
      cleaningOnboarding: {
        // ADM-08: el derecho de acceso (Ley 19.628) exige entregar los datos personales
        // que conservamos. Incluimos los campos provistos por el titular en el onboarding.
        select: {
          id: true,
          status: true,
          categorySlug: true,
          baseCommune: true,
          serviceCommunes: true,
          shortDescription: true,
          yearsExperience: true,
          workMode: true,
          offeredServices: true,
          languages: true,
          maxTravelKm: true,
          hourlyRateClp: true,
          referenceAddress: true,
          documentId: true,
          birthDate: true,
          emergencyContactName: true,
          emergencyContactPhone: true,
          bankName: true,
          bankAccountType: true,
          bankAccountHolder: true,
          bankAccountHolderRut: true,
          bankAccountNumber: true,
          phoneValidatedAt: true,
          identityDocumentFrontFile: true,
          identityDocumentBackFile: true,
          identitySelfieFile: true,
          criminalRecordFile: true,
          submittedAt: true,
          reviewedAt: true,
          approvedAt: true,
          activatedAt: true,
          createdAt: true
        }
      }
    }
  });

  if (!user) {
    return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
  }

  return new NextResponse(JSON.stringify({ exportedAt: new Date().toISOString(), user }, null, 2), {
    status: 200,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": `attachment; filename="wetask-mis-datos-${user.id}.json"`
    }
  });
}
