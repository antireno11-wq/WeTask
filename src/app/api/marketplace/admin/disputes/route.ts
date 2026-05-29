import { BookingStatus, PaymentStatus, Prisma, TicketStatus } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminRequest } from "@/lib/admin-access";
import { recordAdminAction } from "@/lib/audit-log";
import {
  assertTransition,
  canTransition,
  InvalidBookingTransitionError
} from "@/lib/booking-state-machine";
import { logger } from "@/lib/logger";
import { sendPlatformEmail } from "@/lib/notifications";
import { refundProviderPayment } from "@/lib/payments/provider-adapter";
import { prisma } from "@/lib/prisma";

const MAX_PAGE_SIZE = 100;
const DEFAULT_PAGE_SIZE = 30;

const resolveSchema = z.object({
  disputeId: z.string().min(1),
  status: z.enum(["OPEN", "IN_REVIEW", "RESOLVED", "CLOSED"]),
  resolution: z.string().max(1000).optional(),
  refundAmountClp: z.number().int().min(0).optional()
});

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const admin = await requireAdminRequest(req);
    if (!admin.ok) return admin.response;

    const statusParam = req.nextUrl.searchParams.get("status") ?? "";
    const validStatuses: TicketStatus[] = [
      TicketStatus.OPEN,
      TicketStatus.IN_REVIEW,
      TicketStatus.RESOLVED,
      TicketStatus.CLOSED
    ];
    const statusFilter = validStatuses.includes(statusParam as TicketStatus)
      ? (statusParam as TicketStatus)
      : null;

    const search = (req.nextUrl.searchParams.get("q") ?? "").trim();
    const cursor = req.nextUrl.searchParams.get("cursor") ?? null;
    const pageSizeRaw = Number(req.nextUrl.searchParams.get("pageSize") ?? DEFAULT_PAGE_SIZE);
    const pageSize = Number.isFinite(pageSizeRaw)
      ? Math.min(Math.max(pageSizeRaw, 5), MAX_PAGE_SIZE)
      : DEFAULT_PAGE_SIZE;

    const where: Prisma.DisputeTicketWhereInput = {};
    if (statusFilter) where.status = statusFilter;
    if (search) {
      where.OR = [
        { reason: { contains: search, mode: "insensitive" } },
        { resolution: { contains: search, mode: "insensitive" } },
        {
          booking: {
            OR: [
              { id: { contains: search } },
              { customer: { fullName: { contains: search, mode: "insensitive" } } },
              { customer: { email: { contains: search, mode: "insensitive" } } },
              { pro: { fullName: { contains: search, mode: "insensitive" } } },
              { pro: { email: { contains: search, mode: "insensitive" } } }
            ]
          }
        }
      ];
    }

    const items = await prisma.disputeTicket.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "asc" }],
      take: pageSize + 1,
      skip: cursor ? 1 : 0,
      cursor: cursor ? { id: cursor } : undefined,
      include: {
        booking: {
          select: {
            id: true,
            status: true,
            paymentStatus: true,
            totalPriceClp: true,
            scheduledAt: true,
            customer: { select: { id: true, fullName: true, email: true } },
            pro: { select: { id: true, fullName: true, email: true } },
            service: { select: { name: true } }
          }
        }
      }
    });

    const hasMore = items.length > pageSize;
    const visible = hasMore ? items.slice(0, pageSize) : items;
    const nextCursor = hasMore ? visible[visible.length - 1]?.id ?? null : null;

    return NextResponse.json({ disputes: visible, nextCursor }, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      {
        error: "No se pudieron listar disputas",
        detail: error instanceof Error ? error.message : "Error desconocido"
      },
      { status: 400 }
    );
  }
}

async function notifyDisputeResolved(input: {
  customerEmail: string;
  customerName: string;
  customerId: string;
  proEmail: string | null;
  proName: string | null;
  proId: string | null;
  bookingId: string;
  resolution: string | null;
  refundAmountClp: number;
}) {
  const subjectCustomer = "WeTask: actualización de tu reclamo";
  const customerBody =
    input.refundAmountClp > 0
      ? `Tu reclamo de la reserva ${input.bookingId} fue resuelto y se procesó un reembolso de $${input.refundAmountClp.toLocaleString("es-CL")} a tu método de pago.${
          input.resolution ? `\n\nDecisión del equipo:\n${input.resolution}` : ""
        }`
      : `Tu reclamo de la reserva ${input.bookingId} fue revisado por nuestro equipo.${
          input.resolution ? `\n\nDecisión:\n${input.resolution}` : ""
        }`;

  const proBody = `El reclamo de la reserva ${input.bookingId} fue resuelto por el equipo de WeTask.${
    input.resolution ? `\n\nDecisión:\n${input.resolution}` : ""
  }${
    input.refundAmountClp > 0
      ? `\n\nSe procesó un reembolso de $${input.refundAmountClp.toLocaleString("es-CL")} al cliente.`
      : ""
  }`;

  await Promise.allSettled([
    sendPlatformEmail({
      to: input.customerEmail,
      subject: subjectCustomer,
      text: `Hola ${input.customerName},\n\n${customerBody}\n\nEquipo WeTask`
    }),
    input.proEmail
      ? sendPlatformEmail({
          to: input.proEmail,
          subject: "WeTask: el reclamo de tu reserva fue resuelto",
          text: `Hola ${input.proName ?? ""},\n\n${proBody}\n\nEquipo WeTask`
        })
      : Promise.resolve()
  ]);
}

export async function PATCH(req: NextRequest) {
  try {
    const admin = await requireAdminRequest(req);
    if (!admin.ok) return admin.response;

    const body = await req.json();
    const input = resolveSchema.parse(body);

    const dispute = await prisma.disputeTicket.findUnique({
      where: { id: input.disputeId },
      include: {
        booking: {
          select: {
            id: true,
            status: true,
            paymentStatus: true,
            totalPriceClp: true,
            customerId: true,
            proId: true,
            customer: { select: { fullName: true, email: true } },
            pro: { select: { fullName: true, email: true } },
            payment: {
              select: {
                id: true,
                provider: true,
                providerPaymentId: true,
                status: true,
                amountClp: true,
                escrowStatus: true
              }
            },
            payout: { select: { id: true, status: true, amountClp: true } }
          }
        }
      }
    });
    if (!dispute) return NextResponse.json({ error: "Disputa no encontrada" }, { status: 404 });

    const wantsRefund = input.status === "RESOLVED" && typeof input.refundAmountClp === "number" && input.refundAmountClp > 0;
    const refundAmount = wantsRefund ? input.refundAmountClp! : 0;

    // G4/G9: ¿el escrow ya se liberó al tasker? Si es así, MercadoPago no puede
    // revertir esos fondos. En vez de un refund vía MP (que fallaría o saldría de
    // fondos de la plataforma), registramos un CLAWBACK contra el tasker que se
    // descuenta de sus payouts futuros (decisión B), y bloqueamos el refund
    // automático a MP (decisión C). El reembolso al cliente se gestiona aparte.
    const escrowReleased =
      dispute.booking.payment?.escrowStatus === "RELEASED" || dispute.booking.payout?.status === "PAID";
    const useClawback = wantsRefund && escrowReleased;

    if (wantsRefund) {
      if (refundAmount > (dispute.booking.payment?.amountClp ?? 0)) {
        return NextResponse.json(
          { error: "El monto a reembolsar no puede exceder el monto cobrado" },
          { status: 400 }
        );
      }
      if (!canTransition(dispute.booking.status, BookingStatus.REFUNDED, "ADMIN")) {
        return NextResponse.json(
          { error: `No se permite refund desde el estado ${dispute.booking.status}`, from: dispute.booking.status },
          { status: 409 }
        );
      }
      // El refund vía MP requiere providerPaymentId; el clawback no (no toca MP).
      if (!useClawback && (!dispute.booking.payment?.providerPaymentId || dispute.booking.payment.provider !== "MERCADOPAGO")) {
        return NextResponse.json(
          { error: "Este pago no admite reembolso automático (sin providerPaymentId o provider distinto a MERCADOPAGO)" },
          { status: 400 }
        );
      }
    }

    // Llamamos al proveedor ANTES de la transacción para no mantener la
    // transacción abierta durante una llamada HTTP. Si el proveedor falla,
    // la DB se queda intacta. NO se llama a MP cuando usamos clawback.
    let providerRefundResult: Awaited<ReturnType<typeof refundProviderPayment>> | null = null;
    if (wantsRefund && !useClawback) {
      providerRefundResult = await refundProviderPayment("MERCADOPAGO", {
        providerPaymentId: dispute.booking.payment!.providerPaymentId!,
        amount: refundAmount
      });

      if (providerRefundResult.status !== "refunded") {
        return NextResponse.json(
          {
            error: "Mercado Pago rechazó el reembolso. La disputa no fue resuelta.",
            providerStatus: providerRefundResult.providerStatus,
            detail:
              providerRefundResult.errorMessage ??
              providerRefundResult.errorCode ??
              "Sin detalle"
          },
          { status: 502 }
        );
      }
    }

    const isFullRefund = wantsRefund && refundAmount >= (dispute.booking.payment?.amountClp ?? 0);
    const nextPaymentStatus = wantsRefund
      ? isFullRefund
        ? PaymentStatus.REFUNDED
        : PaymentStatus.PARTIAL_REFUNDED
      : null;

    try {
      const result = await prisma.$transaction(async (tx) => {
        const isResolved = input.status === "RESOLVED" || input.status === "CLOSED";

        const updatedDispute = await tx.disputeTicket.update({
          where: { id: dispute.id },
          data: {
            status: input.status,
            resolution: input.resolution,
            refundAmountClp: input.refundAmountClp,
            resolvedAt: isResolved ? new Date() : null,
            resolvedById: isResolved ? admin.identity.userId : null,
            refundedAt: wantsRefund ? new Date() : null,
            refundedProviderPaymentId: wantsRefund
              ? dispute.booking.payment?.providerPaymentId ?? null
              : null
          },
          include: { booking: true }
        });

        if (wantsRefund) {
          assertTransition(dispute.booking.status, BookingStatus.REFUNDED, "ADMIN");
          await tx.booking.update({
            where: { id: dispute.bookingId },
            data: {
              status: BookingStatus.REFUNDED,
              paymentStatus: nextPaymentStatus!
            }
          });
          if (useClawback) {
            // Escrow ya liberado: registramos la deuda del tasker (G4/G9) en vez
            // de tocar MP. Se recuperará de sus payouts futuros.
            await tx.payoutClawback.create({
              data: {
                proId: dispute.booking.proId!,
                bookingId: dispute.bookingId,
                disputeId: dispute.id,
                amountClp: refundAmount,
                reason: input.resolution?.trim() || "Reembolso resuelto tras liberación del escrow",
                status: "PENDING"
              }
            });
            if (dispute.booking.payment) {
              await tx.payment.update({
                where: { id: dispute.booking.payment.id },
                data: { status: nextPaymentStatus!, escrowStatus: "CONTESTED" }
              });
            }
          } else if (dispute.booking.payment) {
            await tx.payment.update({
              where: { id: dispute.booking.payment.id },
              data: {
                status: nextPaymentStatus!,
                providerStatus: providerRefundResult!.providerStatus,
                refundedAt: providerRefundResult!.refundedAt ?? new Date(),
                rawResponseJson: providerRefundResult!.raw as Prisma.InputJsonValue
              }
            });
          }
        }

        // Notificaciones in-app a ambas partes
        const notifyData: Prisma.NotificationCreateManyInput[] = [];
        const customerMsg = wantsRefund
          ? `Tu reclamo fue resuelto y se procesó un reembolso de $${refundAmount.toLocaleString("es-CL")}.`
          : `Tu reclamo fue revisado por el equipo.${input.resolution ? ` Decisión: ${input.resolution}` : ""}`;
        notifyData.push({
          userId: dispute.booking.customerId,
          bookingId: dispute.bookingId,
          title: wantsRefund ? "Reclamo resuelto con reembolso" : "Reclamo actualizado",
          body: customerMsg
        });
        if (dispute.booking.proId) {
          notifyData.push({
            userId: dispute.booking.proId,
            bookingId: dispute.bookingId,
            title: wantsRefund ? "Reclamo resuelto con reembolso al cliente" : "Reclamo actualizado",
            body: `El reclamo de la reserva ${dispute.bookingId} fue resuelto por el equipo de WeTask.${
              wantsRefund
                ? ` Se devolvió $${refundAmount.toLocaleString("es-CL")} al cliente.`
                : ""
            }`
          });
        }
        if (notifyData.length > 0) {
          await tx.notification.createMany({ data: notifyData });
        }

        await recordAdminAction(
          {
            actorId: admin.identity.userId,
            action: wantsRefund ? "dispute.resolve_with_refund" : "dispute.update",
            target: { type: "DisputeTicket", id: dispute.id },
            before: {
              status: dispute.status,
              bookingStatus: dispute.booking.status,
              paymentStatus: dispute.booking.paymentStatus,
              refundAmountClp: dispute.refundAmountClp
            },
            after: {
              status: input.status,
              resolution: input.resolution ?? null,
              refundAmountClp: input.refundAmountClp ?? null,
              bookingStatus: wantsRefund ? BookingStatus.REFUNDED : dispute.booking.status,
              paymentStatus: nextPaymentStatus ?? dispute.booking.paymentStatus,
              providerStatus: providerRefundResult?.providerStatus ?? null
            }
          },
          tx
        );

        return updatedDispute;
      });

      // Email fuera de la transacción
      void notifyDisputeResolved({
        customerEmail: dispute.booking.customer.email,
        customerName: dispute.booking.customer.fullName,
        customerId: dispute.booking.customerId,
        proEmail: dispute.booking.pro?.email ?? null,
        proName: dispute.booking.pro?.fullName ?? null,
        proId: dispute.booking.proId,
        bookingId: dispute.bookingId,
        resolution: input.resolution ?? null,
        refundAmountClp: refundAmount
      });

      return NextResponse.json(
        {
          dispute: result,
          clawback: useClawback
            ? {
                registered: true,
                amountClp: refundAmount,
                note: "El escrow ya estaba liberado al tasker. Se registró un clawback que se descontará de sus payouts futuros. El reembolso al cliente debe gestionarse manualmente (MercadoPago no revierte fondos ya liberados)."
              }
            : null
        },
        { status: 200 }
      );
    } catch (txError) {
      if (txError instanceof InvalidBookingTransitionError) {
        // El refund a MP ya pasó pero la DB falló: el admin tiene que
        // reconciliar manualmente. Loguear con detalle.
        logger.error(
          {
            disputeId: dispute.id,
            bookingStatus: dispute.booking.status,
            providerPaymentId: dispute.booking.payment?.providerPaymentId
          },
          "disputes: refund MP exitoso pero transicion DB invalida"
        );
        return NextResponse.json(
          {
            error: "El reembolso se procesó en Mercado Pago pero la actualización en DB falló. Contactar soporte.",
            providerRefunded: true,
            from: txError.from
          },
          { status: 500 }
        );
      }
      throw txError;
    }
  } catch (error) {
    return NextResponse.json(
      {
        error: "No se pudo actualizar disputa",
        detail: error instanceof Error ? error.message : "Error desconocido"
      },
      { status: 400 }
    );
  }
}
