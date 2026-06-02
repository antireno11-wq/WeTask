import { emitirBoletaServicio, isOpenFacturaConfigured } from "@/lib/billing/openfactura";
import { logError, logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";

/**
 * Idempotente: si el Payment ya tiene `boletaFolio`, no reintenta.
 * Si OpenFactura no está configurado, guarda `boletaStatus="SKIPPED"` para
 * que la pestaña de admin sepa que la deuda existe (y un reintento futuro
 * con envs configuradas pueda procesarla).
 *
 * Llamar como fire-and-forget desde el checkout / webhook tras transición a
 * PaymentStatus.PAID — no bloquea la respuesta al cliente.
 */
export async function emitBoletaForPaymentIfNeeded(paymentId: string): Promise<void> {
  try {
    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
      select: {
        id: true,
        status: true,
        amountClp: true,
        boletaFolio: true,
        booking: {
          select: {
            id: true,
            customer: { select: { fullName: true, email: true } },
            service: { select: { name: true } }
          }
        }
      }
    });

    if (!payment) return;
    if (payment.status !== "PAID") return;
    if (payment.boletaFolio) return;

    if (!isOpenFacturaConfigured()) {
      await prisma.payment.update({
        where: { id: payment.id },
        data: { boletaStatus: "SKIPPED", boletaErrorMessage: "OpenFactura no configurado" }
      });
      logger.warn({ paymentId }, "Boleta omitida: OpenFactura no configurado");
      return;
    }

    const result = await emitirBoletaServicio({
      paymentId: payment.id,
      amountClp: payment.amountClp,
      serviceName: payment.booking.service.name,
      customer: {
        fullName: payment.booking.customer.fullName,
        email: payment.booking.customer.email
      }
    });

    if (result.ok) {
      await prisma.payment.update({
        where: { id: payment.id },
        data: {
          boletaFolio: result.folio,
          boletaUrl: result.url,
          boletaStatus: "EMITTED",
          boletaEmittedAt: new Date(),
          boletaErrorMessage: null
        }
      });
    } else {
      await prisma.payment.update({
        where: { id: payment.id },
        data: {
          boletaStatus: "FAILED",
          boletaErrorMessage: result.detail.slice(0, 500)
        }
      });
    }
  } catch (error) {
    logError("billing.boleta_hook", error, { paymentId });
  }
}
