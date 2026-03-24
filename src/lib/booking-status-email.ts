import { BookingStatus } from "@prisma/client";
import { sendPlatformEmail } from "@/lib/notifications";
import { resolvePublicAppUrl } from "@/lib/public-app-url";
import { prisma } from "@/lib/prisma";

type BookingEmailPayload = {
  bookingId: string;
  nextStatus: BookingStatus;
  previousStatus?: BookingStatus | null;
};

const STATUS_LABELS: Record<BookingStatus, string> = {
  CREATED: "Creada",
  PENDING: "Pendiente",
  PENDING_PAYMENT: "Pendiente de pago",
  PAYMENT_FAILED: "Pago rechazado",
  CONFIRMED: "Confirmada",
  ASSIGNED: "Asignada",
  ACCEPTED: "Aceptada",
  IN_PROGRESS: "En curso",
  COMPLETED: "Completada",
  CANCELLED: "Cancelada",
  DISPUTE: "En revisión",
  REFUNDED: "Reembolsada"
};

function statusCopy(status: BookingStatus, serviceName: string, taskerName: string | null) {
  switch (status) {
    case "PENDING_PAYMENT":
      return {
        subject: `Tu reserva de ${serviceName} está pendiente de pago`,
        title: "Tu reserva quedó pendiente de pago",
        body: "Recibimos tu solicitud, pero el pago aún no se confirma. Apenas cambie el estado te avisaremos por correo."
      };
    case "PAYMENT_FAILED":
      return {
        subject: `El pago de tu reserva de ${serviceName} no fue aprobado`,
        title: "No pudimos confirmar tu pago",
        body: "Tu reserva quedó rechazada por el medio de pago. Puedes volver a intentarlo o elegir otra tarjeta."
      };
    case "CONFIRMED":
      return {
        subject: `Tu reserva de ${serviceName} ya está confirmada`,
        title: "Tu reserva quedó confirmada",
        body: taskerName
          ? `Tu reserva de ${serviceName} ya está confirmada con ${taskerName}.`
          : `Tu reserva de ${serviceName} ya está confirmada y quedó lista para seguir su atención en WeTask.`
      };
    case "ASSIGNED":
      return {
        subject: `Asignamos un tasker a tu reserva de ${serviceName}`,
        title: "Tu reserva ya tiene tasker asignado",
        body: taskerName
          ? `${taskerName} fue asignado a tu reserva de ${serviceName}.`
          : `Tu reserva de ${serviceName} ya tiene tasker asignado.`
      };
    case "ACCEPTED":
      return {
        subject: `Tu tasker aceptó la reserva de ${serviceName}`,
        title: "Tu reserva fue aceptada",
        body: taskerName
          ? `${taskerName} aceptó tu reserva de ${serviceName}.`
          : `Tu reserva de ${serviceName} fue aceptada por el tasker.`
      };
    case "IN_PROGRESS":
      return {
        subject: `Tu servicio de ${serviceName} ya está en curso`,
        title: "Tu servicio está en curso",
        body: "Tu reserva pasó a estado en curso. Cuando termine, podrás confirmar el servicio o reportar un problema."
      };
    case "COMPLETED":
      return {
        subject: `Tu servicio de ${serviceName} fue marcado como completado`,
        title: "Tu servicio fue marcado como completado",
        body: "Revisa el detalle de la reserva para confirmar que todo salió bien o reportar un problema si lo necesitas."
      };
    case "CANCELLED":
      return {
        subject: `Tu reserva de ${serviceName} fue cancelada`,
        title: "Tu reserva fue cancelada",
        body: "La reserva cambió a estado cancelado. Revisa el detalle para ver el contexto y los siguientes pasos."
      };
    case "DISPUTE":
      return {
        subject: `Abrimos una revisión para tu reserva de ${serviceName}`,
        title: "Tu reserva entró en revisión",
        body: "Se abrió un caso sobre esta reserva. Nuestro equipo revisará lo ocurrido y te avisaremos por correo."
      };
    case "REFUNDED":
      return {
        subject: `Tu reserva de ${serviceName} fue reembolsada`,
        title: "Tu reserva fue reembolsada",
        body: "Registramos el reembolso asociado a esta reserva. Puedes revisar el detalle desde tu panel cliente."
      };
    case "PENDING":
      return {
        subject: `Tu reserva de ${serviceName} sigue pendiente`,
        title: "Tu reserva sigue pendiente",
        body: "La reserva quedó pendiente mientras se completa la asignación o confirmación del servicio."
      };
    case "CREATED":
    default:
      return {
        subject: `Actualización en tu reserva de ${serviceName}`,
        title: "Tu reserva tuvo una actualización",
        body: "Hubo un cambio en el estado de tu reserva. Revisa el detalle desde tu panel cliente."
      };
  }
}

function buildBookingStatusEmailTemplate(payload: {
  fullName: string;
  title: string;
  body: string;
  bookingId: string;
  serviceName: string;
  taskerName: string | null;
  statusLabel: string;
  ctaUrl: string;
}) {
  return `
    <div style="margin:0;padding:32px 16px;background:#eef4fb;font-family:Arial,sans-serif;color:#17324d;">
      <div style="max-width:620px;margin:0 auto;background:#ffffff;border-radius:28px;overflow:hidden;box-shadow:0 18px 46px rgba(21,58,97,0.14);border:1px solid rgba(34,97,160,0.12);">
        <div style="padding:28px 32px 18px;background:linear-gradient(135deg,#173e73 0%,#1d7fc6 100%);">
          <p style="margin:0;font-size:13px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:#d8ecff;">Actualización de reserva</p>
          <h1 style="margin:10px 0 0;font-size:28px;line-height:1.12;color:#ffffff;">${payload.title}</h1>
        </div>
        <div style="padding:28px 32px 32px;">
          <p style="margin:0 0 14px;font-size:16px;line-height:1.6;color:#48627d;">Hola ${payload.fullName},</p>
          <p style="margin:0 0 18px;font-size:16px;line-height:1.7;color:#48627d;">${payload.body}</p>
          <div style="display:grid;gap:10px;margin:0 0 24px;padding:18px 20px;border-radius:20px;background:#f4f8fd;border:1px solid rgba(29,127,198,0.18);">
            <p style="margin:0;"><strong>Reserva:</strong> ${payload.bookingId}</p>
            <p style="margin:0;"><strong>Servicio:</strong> ${payload.serviceName}</p>
            <p style="margin:0;"><strong>Tasker:</strong> ${payload.taskerName ?? "Por confirmar"}</p>
            <p style="margin:0;"><strong>Estado:</strong> ${payload.statusLabel}</p>
          </div>
          <div style="text-align:center;">
            <a href="${payload.ctaUrl}" style="display:inline-block;padding:14px 24px;border-radius:999px;background:linear-gradient(135deg,#173e73 0%,#1d7fc6 100%);color:#ffffff;text-decoration:none;font-weight:800;">
              Ver detalle de la reserva
            </a>
          </div>
        </div>
      </div>
    </div>
  `;
}

export async function sendBookingStatusEmailToCustomer(payload: BookingEmailPayload) {
  if (payload.previousStatus && payload.previousStatus === payload.nextStatus) return;

  const booking = await prisma.booking.findUnique({
    where: { id: payload.bookingId },
    select: {
      id: true,
      customer: { select: { fullName: true, email: true } },
      pro: { select: { fullName: true } },
      service: { select: { name: true } }
    }
  });

  if (!booking?.customer?.email) return;

  const appUrl = resolvePublicAppUrl();
  const ctaUrl = `${appUrl}/cliente/reservas/${booking.id}`;
  const copy = statusCopy(payload.nextStatus, booking.service.name, booking.pro?.fullName ?? null);

  try {
    await sendPlatformEmail({
      to: booking.customer.email,
      subject: copy.subject,
      text:
        `Hola ${booking.customer.fullName},\n\n` +
        `${copy.body}\n\n` +
        `Reserva: ${booking.id}\n` +
        `Servicio: ${booking.service.name}\n` +
        `Tasker: ${booking.pro?.fullName ?? "Por confirmar"}\n` +
        `Estado: ${STATUS_LABELS[payload.nextStatus]}\n\n` +
        `Revisa el detalle aquí:\n${ctaUrl}\n\nEquipo WeTask`,
      html: buildBookingStatusEmailTemplate({
        fullName: booking.customer.fullName,
        title: copy.title,
        body: copy.body,
        bookingId: booking.id,
        serviceName: booking.service.name,
        taskerName: booking.pro?.fullName ?? null,
        statusLabel: STATUS_LABELS[payload.nextStatus],
        ctaUrl
      })
    });
    console.info("[booking-email] status update sent", {
      bookingId: booking.id,
      to: booking.customer.email,
      previousStatus: payload.previousStatus ?? null,
      nextStatus: payload.nextStatus
    });
  } catch (error) {
    console.error("[booking-email] status update failed", {
      bookingId: payload.bookingId,
      previousStatus: payload.previousStatus ?? null,
      nextStatus: payload.nextStatus,
      detail: error instanceof Error ? error.message : "unknown"
    });
  }
}
