import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminRequest } from "@/lib/admin-access";
import { recordAdminAction } from "@/lib/audit-log";
import { prisma } from "@/lib/prisma";

const resolveSchema = z.object({
  disputeId: z.string().min(1),
  status: z.enum(["OPEN", "IN_REVIEW", "RESOLVED", "CLOSED"]),
  resolution: z.string().max(1000).optional(),
  refundAmountClp: z.number().int().min(0).optional()
});

export async function GET(req: NextRequest) {
  try {
    const admin = await requireAdminRequest(req);
    if (!admin.ok) return admin.response;

    const disputes = await prisma.disputeTicket.findMany({
      orderBy: [{ createdAt: "desc" }],
      include: {
        booking: {
          select: {
            id: true,
            status: true,
            paymentStatus: true,
            customer: { select: { fullName: true, email: true } },
            pro: { select: { fullName: true, email: true } }
          }
        }
      }
    });

    return NextResponse.json({ disputes }, { status: 200 });
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

export async function PATCH(req: NextRequest) {
  try {
    const admin = await requireAdminRequest(req);
    if (!admin.ok) return admin.response;

    const body = await req.json();
    const input = resolveSchema.parse(body);

    const dispute = await prisma.disputeTicket.findUnique({
      where: { id: input.disputeId },
      include: {
        booking: { select: { id: true, status: true, paymentStatus: true } }
      }
    });
    if (!dispute) return NextResponse.json({ error: "Disputa no encontrada" }, { status: 404 });

    const result = await prisma.$transaction(async (tx) => {
      const updated = await tx.disputeTicket.update({
        where: { id: dispute.id },
        data: {
          status: input.status,
          resolution: input.resolution,
          refundAmountClp: input.refundAmountClp
        },
        include: { booking: true }
      });

      // NOTA: Acá sólo se actualiza la DB. El refund real a MercadoPago
      // se hace por separado vía POST /api/admin/payments/refund. Esto
      // queda pendiente de fusionarse en Fase 4 (refund real en disputas).
      if (input.status === "RESOLVED" && typeof input.refundAmountClp === "number" && input.refundAmountClp > 0) {
        await tx.booking.update({
          where: { id: dispute.bookingId },
          data: {
            status: "REFUNDED",
            paymentStatus: "PARTIAL_REFUNDED"
          }
        });

        await tx.payment.updateMany({
          where: { bookingId: dispute.bookingId },
          data: { status: "PARTIAL_REFUNDED" }
        });
      }

      await recordAdminAction(
        {
          actorId: admin.identity.userId,
          action: "dispute.resolve",
          target: { type: "DisputeTicket", id: dispute.id },
          before: {
            status: dispute.status,
            bookingStatus: dispute.booking?.status,
            paymentStatus: dispute.booking?.paymentStatus
          },
          after: {
            status: input.status,
            resolution: input.resolution ?? null,
            refundAmountClp: input.refundAmountClp ?? null
          }
        },
        tx
      );

      return updated;
    });

    return NextResponse.json({ dispute: result }, { status: 200 });
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
