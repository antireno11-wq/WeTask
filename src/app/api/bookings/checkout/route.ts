import { PaymentStatus, UserRole } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { sendBookingStatusEmailToCustomer } from "@/lib/booking-status-email";
import { getRequestIdentity, hasRole } from "@/lib/auth";
import { COVERAGE_UNAVAILABLE_MESSAGE, inferCommuneFromAddress, normalizeCommune, taskerServesCommune } from "@/lib/communes";
import { calculateMarketplacePrice } from "@/lib/marketplace-pricing";
import { createProviderPayment } from "@/lib/payments/provider-adapter";
import { prisma } from "@/lib/prisma";
import { hasAssignedRole } from "@/lib/user-roles";

export const dynamic = "force-dynamic";

const checkoutSchema = z.object({
  customerId: z.string().min(1),
  serviceId: z.string().min(1),
  proId: z.string().min(1).optional(),
  slotId: z.string().min(1).optional(),
  startsAt: z.coerce.date(),
  hours: z.coerce.number().int().min(1).max(8),
  address: z.object({
    street: z.string().min(5),
    commune: z.string().min(2),
    city: z.string().min(2),
    postalCode: z.string().min(4).max(12),
    region: z.string().min(2).optional()
  }),
  details: z.string().max(1000).optional(),
  extras: z
    .object({
      materials: z.boolean().optional().default(false),
      urgency: z.boolean().optional().default(false),
      travelFeeClp: z.coerce.number().int().min(0).optional().default(0)
    })
    .optional()
    .default({ materials: false, urgency: false, travelFeeClp: 0 }),
  payment: z.object({
    token: z.string().min(6).optional(),
    paymentMethodId: z.string().min(2).optional(),
    issuerId: z.string().optional(),
    installments: z.coerce.number().int().min(1).max(48).default(1),
    payerEmail: z.string().email().optional(),
    payerIdentificationType: z.string().max(10).optional(),
    payerIdentificationNumber: z.string().max(32).optional(),
    savedCardId: z.string().min(1).optional()
  }).superRefine((payment, ctx) => {
    if (payment.savedCardId) return;
    if (!payment.token) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Falta el token de la tarjeta", path: ["token"] });
    }
    if (!payment.payerEmail) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Falta el correo del pagador", path: ["payerEmail"] });
    }
  }),
  idempotencyKey: z.string().min(8).max(120).optional()
});

function sanitizeIdempotencyKey(raw: string) {
  return raw.replace(/[^a-zA-Z0-9:_-]/g, "_").slice(0, 120);
}

function paymentStateFromProviderStatus(status: "approved" | "failed" | "pending" | "refunded") {
  if (status === "approved") return { paymentStatus: PaymentStatus.PAID, bookingStatus: "CONFIRMED" as const };
  if (status === "refunded") return { paymentStatus: PaymentStatus.REFUNDED, bookingStatus: "REFUNDED" as const };
  if (status === "pending") return { paymentStatus: PaymentStatus.PENDING, bookingStatus: "PENDING_PAYMENT" as const };
  return { paymentStatus: PaymentStatus.FAILED, bookingStatus: "PAYMENT_FAILED" as const };
}

export async function POST(req: NextRequest) {
  const identity = getRequestIdentity(req);
  if (!hasRole(identity.role, [UserRole.CUSTOMER, UserRole.ADMIN])) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const input = checkoutSchema.parse(body);

    if (identity.role === UserRole.CUSTOMER && identity.userId !== input.customerId) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const clientCommune =
      normalizeCommune(input.address.commune) ?? inferCommuneFromAddress(`${input.address.street}, ${input.address.city}, Chile`);

    if (!clientCommune) {
      return NextResponse.json({ error: COVERAGE_UNAVAILABLE_MESSAGE }, { status: 400 });
    }

    const [customer, service] = await Promise.all([
      prisma.user.findUnique({ where: { id: input.customerId }, include: { roleAssignments: { select: { role: { select: { code: true } } } } } }),
      prisma.service.findUnique({ where: { id: input.serviceId }, include: { category: true } })
    ]);

    if (!customer || !hasAssignedRole(customer, UserRole.CUSTOMER)) {
      return NextResponse.json({ error: "Cliente no válido" }, { status: 400 });
    }
    if (!service || !service.isActive || !service.category) {
      return NextResponse.json({ error: "Servicio no disponible" }, { status: 400 });
    }
    const serviceCategory = service.category;
    if (input.hours < serviceCategory.minHours) {
      return NextResponse.json({ error: `Mínimo ${serviceCategory.minHours} hora(s) para este servicio` }, { status: 400 });
    }

    let assignedProId = input.proId ?? null;
    let selectedSlotId = input.slotId ?? null;
    let hourlyRateClp = service.basePriceClp;
    let savedPaymentMethod:
      | {
          providerCustomerId: string;
          providerCardId: string;
          paymentMethodId: string | null;
          payerEmail: string | null;
        }
      | null = null;

    if (input.payment.savedCardId) {
      savedPaymentMethod = await prisma.customerPaymentMethod.findFirst({
        where: { id: input.payment.savedCardId, userId: input.customerId },
        select: {
          providerCustomerId: true,
          providerCardId: true,
          paymentMethodId: true,
          payerEmail: true
        }
      });

      if (!savedPaymentMethod) {
        return NextResponse.json({ error: "La tarjeta guardada no pertenece al cliente" }, { status: 400 });
      }
    }

    if (selectedSlotId) {
      const slot = await prisma.availabilitySlot.findUnique({
        where: { id: selectedSlotId },
        include: {
          professionalProfile: {
            select: {
              userId: true,
              coverageComuna: true,
              taskerServices: {
                where: { serviceId: input.serviceId, isActive: true },
                select: { id: true, priceClp: true }
              },
              user: {
                select: {
                  cleaningOnboarding: {
                    select: {
                      baseCommune: true,
                      serviceCommunes: true
                    }
                  }
                }
              }
            }
          }
        }
      });

      if (!slot || !slot.isAvailable) {
        return NextResponse.json({ error: "Horario no disponible" }, { status: 409 });
      }
      if (slot.startsAt.getTime() !== input.startsAt.getTime()) {
        return NextResponse.json({ error: "El horario enviado no coincide con el slot" }, { status: 400 });
      }
      if (slot.serviceId && slot.serviceId !== input.serviceId) {
        return NextResponse.json({ error: "El horario no pertenece al servicio elegido" }, { status: 400 });
      }
      if (slot.professionalProfile.taskerServices.length === 0) {
        return NextResponse.json({ error: "El tasker no ofrece este servicio" }, { status: 400 });
      }

      const canServe = taskerServesCommune(
        {
          serviceCommunes: slot.professionalProfile.user.cleaningOnboarding?.serviceCommunes,
          coverageComuna: slot.professionalProfile.coverageComuna ?? slot.professionalProfile.user.cleaningOnboarding?.baseCommune
        },
        clientCommune
      );
      if (!canServe) {
        return NextResponse.json({ error: "El tasker no atiende esa comuna" }, { status: 400 });
      }

      assignedProId = slot.professionalProfile.userId;
      hourlyRateClp = slot.professionalProfile.taskerServices[0]?.priceClp ?? hourlyRateClp;
    } else if (assignedProId) {
      const pro = await prisma.user.findUnique({
        where: { id: assignedProId },
        select: {
          role: true,
          professionalProfile: {
            select: {
              coverageComuna: true,
              taskerServices: {
                where: { serviceId: input.serviceId, isActive: true },
                select: { id: true, priceClp: true }
              }
            }
          },
          cleaningOnboarding: {
            select: {
              baseCommune: true,
              serviceCommunes: true
            }
          }
        }
      });

      if (!pro || pro.role !== UserRole.PRO || !pro.professionalProfile || pro.professionalProfile.taskerServices.length === 0) {
        return NextResponse.json({ error: "Tasker inválido para este servicio" }, { status: 400 });
      }

      const canServe = taskerServesCommune(
        {
          serviceCommunes: pro.cleaningOnboarding?.serviceCommunes,
          coverageComuna: pro.professionalProfile.coverageComuna ?? pro.cleaningOnboarding?.baseCommune
        },
        clientCommune
      );
      if (!canServe) {
        return NextResponse.json({ error: "El tasker no atiende esa comuna" }, { status: 400 });
      }

      hourlyRateClp = pro.professionalProfile.taskerServices[0]?.priceClp ?? hourlyRateClp;
    }

    const price = calculateMarketplacePrice({
      hourlyRateClp,
      hours: input.hours,
      materials: Boolean(input.extras?.materials),
      urgency: Boolean(input.extras?.urgency),
      travelFeeClp: input.extras?.travelFeeClp ?? 0,
      materialFeeDefaultClp: serviceCategory.materialFeeDefaultClp,
      urgencyFeeClp: serviceCategory.urgencyFeeClp,
      platformFeePct: Number(serviceCategory.basePlatformFeePct)
    });

    const derivedKey = input.idempotencyKey
      ? input.idempotencyKey
      : `checkout_${input.customerId}_${selectedSlotId ?? "noslot"}_${input.startsAt.getTime()}_${price.totalClp}`;
    const idempotencyKey = sanitizeIdempotencyKey(derivedKey);
    const paymentMethodId = savedPaymentMethod?.paymentMethodId ?? input.payment.paymentMethodId ?? null;
    if (!paymentMethodId) {
      return NextResponse.json({ error: "Falta el medio de pago seleccionado" }, { status: 400 });
    }
    const normalizedPayerEmail = (savedPaymentMethod?.payerEmail ?? input.payment.payerEmail ?? customer.email).trim().toLowerCase();

    const existing = await prisma.payment.findUnique({
      where: { idempotencyKey },
      include: {
        booking: {
          select: { id: true, status: true, paymentStatus: true, totalPriceClp: true }
        }
      }
    });

    if (existing?.booking) {
      return NextResponse.json(
        {
          booking: existing.booking,
          payment: {
            id: existing.id,
            status: existing.status,
            providerStatus: existing.providerStatus,
            providerPaymentId: existing.providerPaymentId
          },
          idempotentReplay: true
        },
        { status: 200 }
      );
    }

    const created = await prisma.$transaction(async (tx) => {
      if (selectedSlotId) {
        const lock = await tx.availabilitySlot.updateMany({
          where: { id: selectedSlotId, isAvailable: true },
          data: { isAvailable: false }
        });
        if (lock.count === 0) {
          throw new Error("El horario ya fue tomado por otro cliente");
        }
      }

      const address = await tx.address.create({
        data: {
          userId: customer.id,
          street: input.address.street.trim(),
          city: input.address.city.trim(),
          postalCode: input.address.postalCode.trim(),
          region: input.address.region?.trim() || "Santiago",
          country: "CL"
        }
      });

      const booking = await tx.booking.create({
        data: {
          customerId: customer.id,
          proId: assignedProId,
          serviceId: input.serviceId,
          bookedSlotId: selectedSlotId,
          addressId: address.id,
          status: "PENDING_PAYMENT",
          scheduledAt: input.startsAt,
          addressLine1: input.address.street.trim(),
          comuna: clientCommune,
          region: input.address.region?.trim() || "Santiago",
          city: input.address.city.trim(),
          postalCode: input.address.postalCode.trim(),
          notes: input.details?.trim() || null,
          hours: input.hours,
          slotMinutes: serviceCategory.slotMinutes,
          autoAssign: false,
          hourlyPriceClp: price.hourlyRateClp,
          subtotalClp: price.subtotalClp,
          extrasTotalClp: price.extrasTotalClp,
          platformFeeClp: price.platformFeeClp,
          totalPriceClp: price.totalClp,
          paymentStatus: PaymentStatus.PENDING,
          extras: {
            create: price.extras.map((item) => ({
              code: item.code,
              name: item.name,
              priceClp: item.priceClp,
              quantity: 1
            }))
          }
        }
      });

      const payment = await tx.payment.create({
        data: {
          bookingId: booking.id,
          provider: "MERCADOPAGO",
          providerStatus: "created",
          amountClp: price.totalClp,
          platformFeeClp: price.platformFeeClp,
          status: PaymentStatus.PENDING,
          currency: "CLP",
          paymentMethod: paymentMethodId,
          payerEmail: normalizedPayerEmail,
          idempotencyKey
        }
      });

      return { booking, payment };
    });

    let providerResult;
    try {
      providerResult = await createProviderPayment("MERCADOPAGO", {
        amount: price.totalClp,
        currency: "CLP",
        description: `${service.name} · WeTask`,
        externalReference: created.booking.id,
        idempotencyKey,
        token: input.payment.token,
        paymentMethodId,
        issuerId: input.payment.issuerId,
        installments: input.payment.installments,
        payerEmail: normalizedPayerEmail,
        payerIdentification:
          input.payment.payerIdentificationType && input.payment.payerIdentificationNumber
            ? {
                type: input.payment.payerIdentificationType,
                number: input.payment.payerIdentificationNumber
              }
            : undefined,
        customerId: savedPaymentMethod?.providerCustomerId,
        cardId: savedPaymentMethod?.providerCardId
      });
    } catch (providerError) {
      await prisma.$transaction(async (tx) => {
        await tx.payment.update({
          where: { id: created.payment.id },
          data: {
            status: PaymentStatus.FAILED,
            providerStatus: "provider_error",
            errorMessage: providerError instanceof Error ? providerError.message : "Error en proveedor"
          }
        });
        await tx.booking.update({
          where: { id: created.booking.id },
          data: {
            status: "PAYMENT_FAILED",
            paymentStatus: PaymentStatus.FAILED
          }
        });
        if (selectedSlotId) {
          await tx.availabilitySlot.updateMany({
            where: { id: selectedSlotId },
            data: { isAvailable: true }
          });
        }
      });

      void sendBookingStatusEmailToCustomer({
        bookingId: created.booking.id,
        previousStatus: created.booking.status,
        nextStatus: "PAYMENT_FAILED"
      });

      return NextResponse.json({ error: "Error de conexión con Mercado Pago. Intenta nuevamente." }, { status: 502 });
    }

    const nextState = paymentStateFromProviderStatus(providerResult.status);

    const finalBooking = await prisma.$transaction(async (tx) => {
      await tx.payment.update({
        where: { id: created.payment.id },
        data: {
          providerPaymentId: providerResult.providerPaymentId ?? undefined,
          providerStatus: providerResult.providerStatus,
          status: nextState.paymentStatus,
          paidAt: providerResult.paidAt,
          refundedAt: providerResult.refundedAt,
          paymentMethod: providerResult.paymentMethod ?? created.payment.paymentMethod,
          last4: providerResult.last4 ?? null,
          payerEmail: normalizedPayerEmail,
          rawResponseJson: providerResult.raw as any,
          errorCode: providerResult.errorCode ?? null,
          errorMessage: providerResult.errorMessage ?? null
        }
      });

      const booking = await tx.booking.update({
        where: { id: created.booking.id },
        data: {
          status: nextState.bookingStatus,
          paymentStatus: nextState.paymentStatus
        },
        select: {
          id: true,
          status: true,
          paymentStatus: true,
          totalPriceClp: true
        }
      });

      if (nextState.bookingStatus === "PAYMENT_FAILED" && selectedSlotId) {
        await tx.availabilitySlot.updateMany({
          where: { id: selectedSlotId },
          data: { isAvailable: true }
        });
      }

      if (nextState.bookingStatus === "CONFIRMED") {
        await tx.notification.create({
          data: {
            userId: customer.id,
            bookingId: created.booking.id,
            title: "Pago aprobado",
            body: `Tu reserva ${created.booking.id} quedó confirmada.`
          }
        });
        if (assignedProId) {
          await tx.notification.create({
            data: {
              userId: assignedProId,
              bookingId: created.booking.id,
              title: "Nueva reserva pagada",
              body: `Se confirmó una nueva reserva para ${service.name}.`
            }
          });
        }
      }

      return booking;
    });

    void sendBookingStatusEmailToCustomer({
      bookingId: finalBooking.id,
      previousStatus: created.booking.status,
      nextStatus: finalBooking.status
    });

    return NextResponse.json(
      {
        booking: finalBooking,
        payment: {
          id: created.payment.id,
          provider: "MERCADOPAGO",
          providerPaymentId: providerResult.providerPaymentId,
          providerStatus: providerResult.providerStatus,
          status: nextState.paymentStatus,
          paymentMethod: providerResult.paymentMethod,
          last4: providerResult.last4
        }
      },
      { status: 200 }
    );
  } catch (error) {
    return NextResponse.json(
      {
        error: "No se pudo procesar checkout",
        detail: error instanceof Error ? error.message : "Error desconocido"
      },
      { status: 400 }
    );
  }
}
