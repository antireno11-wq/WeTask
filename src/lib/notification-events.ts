import { Prisma } from "@prisma/client";
import { logError } from "@/lib/logger";
import {
  buildBookingConfirmedTemplate,
  buildBookingReminderTemplate,
  buildGenericTransactionalEmail,
  buildPayoutReleasedTemplate,
  buildReviewReceivedTemplate,
  sendPlatformEmail
} from "@/lib/notifications";
import { prisma } from "@/lib/prisma";
type Recipient = {
  userId: string;
  email: string;
  fullName: string;
  role: "CUSTOMER" | "PRO";
};

type BookingContext = {
  id: string;
  serviceName: string;
  scheduledAt: Date;
  address: string;
  totalClp: number;
};

function appUrl() {
  // En cron/server-side no tenemos req; usamos env con fallback razonable.
  const fromEnv =
    process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/+$/, "") ||
    process.env.APP_URL?.trim().replace(/\/+$/, "");
  return fromEnv || "https://wetask.cl";
}

function formatScheduledAt(value: Date) {
  return value.toLocaleString("es-CL", {
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit"
  });
}

async function safelySend(
  to: string,
  subject: string,
  text: string,
  html: string,
  metadata: Record<string, string>
) {
  try {
    await sendPlatformEmail({ to, subject, text, html });
  } catch (err) {
    logError("notification-events.send_email", err, { to, subject, metadata });
  }
}

async function createNotification(
  data: Prisma.NotificationCreateInput | Prisma.NotificationUncheckedCreateInput,
  tx?: Prisma.TransactionClient
) {
  const client = tx ?? prisma;
  try {
    await client.notification.create({ data });
  } catch (err) {
    logError("notification-events.create_notification", err, { data });
  }
}

// ---------------------------------------------------------------------------
// Booking lifecycle
// ---------------------------------------------------------------------------

export async function notifyBookingCreated(
  input: { customer: Recipient; booking: BookingContext },
  tx?: Prisma.TransactionClient
) {
  await createNotification(
    {
      userId: input.customer.userId,
      bookingId: input.booking.id,
      title: "Estamos procesando tu reserva",
      body: `Te avisaremos en cuanto el pago de ${input.booking.serviceName} quede aprobado.`
    },
    tx
  );
}

export async function notifyBookingConfirmed(
  input: { customer: Recipient; pro: Recipient | null; booking: BookingContext },
  tx?: Prisma.TransactionClient
) {
  const baseUrl = appUrl();
  const customerCta = `${baseUrl}/cliente/reservas/${input.booking.id}`;
  const proCta = input.pro ? `${baseUrl}/pro/reservas/${input.booking.id}` : null;
  const scheduledLabel = formatScheduledAt(input.booking.scheduledAt);

  await createNotification(
    {
      userId: input.customer.userId,
      bookingId: input.booking.id,
      title: "Tu reserva está confirmada",
      body: `${input.booking.serviceName} agendado para ${scheduledLabel}.`
    },
    tx
  );
  if (input.pro) {
    await createNotification(
      {
        userId: input.pro.userId,
        bookingId: input.booking.id,
        title: "Tenés una reserva nueva",
        body: `${input.booking.serviceName} con ${input.customer.fullName} el ${scheduledLabel}.`
      },
      tx
    );
  }

  // Emails (fuera de tx — best effort).
  void safelySend(
    input.customer.email,
    "WeTask: tu reserva está confirmada",
    `Tu reserva ${input.booking.id} quedó confirmada para ${scheduledLabel}.`,
    buildBookingConfirmedTemplate({
      fullName: input.customer.fullName,
      bookingId: input.booking.id,
      serviceName: input.booking.serviceName,
      scheduledAt: scheduledLabel,
      address: input.booking.address,
      totalClp: input.booking.totalClp,
      ctaUrl: customerCta,
      role: "CUSTOMER"
    }),
    { event: "booking.confirmed", role: "CUSTOMER", bookingId: input.booking.id }
  );
  if (input.pro && proCta) {
    void safelySend(
      input.pro.email,
      "WeTask: recibiste una reserva nueva",
      `Tenés una reserva nueva para ${scheduledLabel}.`,
      buildBookingConfirmedTemplate({
        fullName: input.pro.fullName,
        bookingId: input.booking.id,
        serviceName: input.booking.serviceName,
        scheduledAt: scheduledLabel,
        address: input.booking.address,
        totalClp: input.booking.totalClp,
        ctaUrl: proCta,
        role: "PRO"
      }),
      { event: "booking.confirmed", role: "PRO", bookingId: input.booking.id }
    );
  }
}

export async function notifyBookingReminder(input: {
  recipient: Recipient;
  booking: BookingContext;
  hoursUntil: number;
}) {
  const baseUrl = appUrl();
  const cta =
    input.recipient.role === "PRO"
      ? `${baseUrl}/pro/reservas/${input.booking.id}`
      : `${baseUrl}/cliente/reservas/${input.booking.id}`;
  const scheduledLabel = formatScheduledAt(input.booking.scheduledAt);

  await createNotification({
    userId: input.recipient.userId,
    bookingId: input.booking.id,
    title: input.hoursUntil === 1 ? "Tu servicio empieza pronto" : "Recordatorio: tu servicio es mañana",
    body: `${input.booking.serviceName} a las ${scheduledLabel}.`
  });

  void safelySend(
    input.recipient.email,
    input.hoursUntil === 1 ? "WeTask: tu servicio empieza pronto" : "WeTask: recordatorio de tu servicio",
    `Tu servicio ${input.booking.serviceName} es en ${input.hoursUntil} hora(s).`,
    buildBookingReminderTemplate({
      fullName: input.recipient.fullName,
      serviceName: input.booking.serviceName,
      scheduledAt: scheduledLabel,
      address: input.booking.address,
      hoursUntil: input.hoursUntil,
      ctaUrl: cta,
      role: input.recipient.role
    }),
    { event: "booking.reminder", hoursUntil: String(input.hoursUntil), bookingId: input.booking.id }
  );
}

export async function notifyOnTheWay(input: {
  customer: Recipient;
  pro: Recipient;
  bookingId: string;
  scheduledAt: Date;
}) {
  const baseUrl = appUrl();
  const scheduledLabel = formatScheduledAt(input.scheduledAt);
  await createNotification({
    userId: input.customer.userId,
    bookingId: input.bookingId,
    title: `${input.pro.fullName.split(" ")[0]} ya viene en camino`,
    body: `Tu profesional avisó que está saliendo hacia la dirección. Hora pactada: ${scheduledLabel}.`
  });
  void safelySend(
    input.customer.email,
    "WeTask: tu profesional va en camino",
    `${input.pro.fullName} avisó que está en camino para tu reserva ${input.bookingId}.`,
    buildGenericTransactionalEmail({
      fullName: input.customer.fullName,
      title: "Tu profesional ya viene en camino",
      intro: `${input.pro.fullName} avisó que está saliendo hacia tu dirección.`,
      bullets: [
        { label: "Hora pactada", value: scheduledLabel },
        { label: "Profesional", value: input.pro.fullName }
      ],
      ctaLabel: "Ver mi reserva",
      ctaUrl: `${baseUrl}/cliente/reservas/${input.bookingId}`
    }),
    { event: "booking.on_the_way", bookingId: input.bookingId }
  );
}

export async function notifyCheckedIn(input: {
  customer: Recipient;
  pro: Recipient;
  bookingId: string;
  checkInAt: Date;
}) {
  const baseUrl = appUrl();
  const arrivedLabel = input.checkInAt.toLocaleString("es-CL", {
    hour: "2-digit",
    minute: "2-digit"
  });
  await createNotification({
    userId: input.customer.userId,
    bookingId: input.bookingId,
    title: `${input.pro.fullName.split(" ")[0]} ya llegó`,
    body: `Tu profesional marcó llegada a las ${arrivedLabel}.`
  });
  void safelySend(
    input.customer.email,
    "WeTask: tu profesional llegó",
    `${input.pro.fullName} ya está en el lugar para tu reserva ${input.bookingId}.`,
    buildGenericTransactionalEmail({
      fullName: input.customer.fullName,
      title: "Tu profesional llegó",
      intro: `${input.pro.fullName} marcó llegada a la dirección a las ${arrivedLabel}.`,
      ctaLabel: "Ver mi reserva",
      ctaUrl: `${baseUrl}/cliente/reservas/${input.bookingId}`
    }),
    { event: "booking.checked_in", bookingId: input.bookingId }
  );
}

export async function notifyBookingCompleted(
  input: { customer: Recipient; pro: Recipient | null; bookingId: string; serviceName: string },
  tx?: Prisma.TransactionClient
) {
  const baseUrl = appUrl();
  await createNotification(
    {
      userId: input.customer.userId,
      bookingId: input.bookingId,
      title: "Servicio completado",
      body: `Tu servicio ${input.serviceName} fue marcado como completado.`
    },
    tx
  );
  if (input.pro) {
    await createNotification(
      {
        userId: input.pro.userId,
        bookingId: input.bookingId,
        title: "Servicio cerrado",
        body: "Marcaste el servicio como completado. Esperamos la confirmación del cliente."
      },
      tx
    );
  }

  void safelySend(
    input.customer.email,
    "WeTask: tu servicio fue completado",
    `Tu servicio ${input.serviceName} fue marcado como completado. Confirmá o reportá un problema en tu panel.`,
    buildGenericTransactionalEmail({
      fullName: input.customer.fullName,
      title: "Tu servicio fue completado",
      intro: `${input.serviceName} fue marcado como completado por tu profesional.`,
      body: "Si todo estuvo bien, confirma en la app para que el pago se libere. Si hay algún problema, puedes abrir un reclamo en las próximas 48h.",
      ctaLabel: "Confirmar o reportar",
      ctaUrl: `${baseUrl}/cliente/reservas/${input.bookingId}`
    }),
    { event: "booking.completed", bookingId: input.bookingId }
  );
}

// ---------------------------------------------------------------------------
// Payout
// ---------------------------------------------------------------------------

export async function notifyPayoutReleased(input: {
  pro: Recipient;
  bookingId: string;
  amountClp: number;
}) {
  const baseUrl = appUrl();
  await createNotification({
    userId: input.pro.userId,
    bookingId: input.bookingId,
    title: "Tu pago fue liberado",
    body: `Recibiste $${input.amountClp.toLocaleString("es-CL")} por la reserva ${input.bookingId}.`
  });
  void safelySend(
    input.pro.email,
    "WeTask: tu pago fue liberado",
    `Recibiste $${input.amountClp.toLocaleString("es-CL")} CLP por la reserva ${input.bookingId}.`,
    buildPayoutReleasedTemplate({
      fullName: input.pro.fullName,
      bookingId: input.bookingId,
      amountClp: input.amountClp,
      ctaUrl: `${baseUrl}/pro`
    }),
    { event: "payout.released", bookingId: input.bookingId }
  );
}

// ---------------------------------------------------------------------------
// Review
// ---------------------------------------------------------------------------

export async function notifyReviewReceived(input: {
  pro: Recipient;
  customerName: string;
  serviceName: string;
  rating: number;
  comment: string | null;
  bookingId: string;
}) {
  const baseUrl = appUrl();
  await createNotification({
    userId: input.pro.userId,
    bookingId: input.bookingId,
    title: "Recibiste una reseña nueva",
    body: `${input.customerName} te puso ${input.rating}/5 por ${input.serviceName}.`
  });
  void safelySend(
    input.pro.email,
    "WeTask: nueva reseña recibida",
    `${input.customerName} te dejó una reseña de ${input.rating} estrellas.`,
    buildReviewReceivedTemplate({
      fullName: input.pro.fullName,
      rating: input.rating,
      comment: input.comment,
      customerName: input.customerName,
      serviceName: input.serviceName,
      ctaUrl: `${baseUrl}/pro`
    }),
    { event: "review.received", bookingId: input.bookingId }
  );
}

// ---------------------------------------------------------------------------
// Disputes
// ---------------------------------------------------------------------------

export async function notifyDisputeOpened(input: {
  customer: Recipient;
  pro: Recipient | null;
  bookingId: string;
  reason: string;
}) {
  const baseUrl = appUrl();
  await createNotification({
    userId: input.customer.userId,
    bookingId: input.bookingId,
    title: "Tu reclamo fue recibido",
    body: "El equipo de WeTask revisará tu caso y te responderá en las próximas 48-72h."
  });
  if (input.pro) {
    await createNotification({
      userId: input.pro.userId,
      bookingId: input.bookingId,
      title: "Reclamo abierto en una reserva",
      body: `El cliente abrió un reclamo. Motivo: ${input.reason.slice(0, 140)}`
    });
  }
  void safelySend(
    input.customer.email,
    "WeTask: recibimos tu reclamo",
    `Tu reclamo de la reserva ${input.bookingId} está en revisión.`,
    buildGenericTransactionalEmail({
      fullName: input.customer.fullName,
      title: "Recibimos tu reclamo",
      intro: "El equipo de WeTask revisará tu caso y te responderá en las próximas 48-72h.",
      body: "Mientras tanto el pago queda retenido hasta que se resuelva.",
      ctaLabel: "Ver mi reclamo",
      ctaUrl: `${baseUrl}/cliente/reservas/${input.bookingId}`
    }),
    { event: "dispute.opened", bookingId: input.bookingId }
  );
}

// ---------------------------------------------------------------------------
// Onboarding
// ---------------------------------------------------------------------------

export async function notifyOnboardingSubmitted(input: { taskerUserId: string; taskerEmail: string; taskerName: string }) {
  const baseUrl = appUrl();
  await createNotification({
    userId: input.taskerUserId,
    title: "Tu perfil quedó en revisión",
    body: "El equipo de WeTask va a revisar tus documentos y datos. Te avisaremos en cuanto haya respuesta."
  });
  void safelySend(
    input.taskerEmail,
    "WeTask: tu perfil quedó en revisión",
    "Recibimos tu solicitud. El equipo la va a revisar pronto.",
    buildGenericTransactionalEmail({
      fullName: input.taskerName,
      title: "Tu perfil quedó en revisión",
      intro: "Tu perfil fue enviado para validación interna del equipo WeTask.",
      body: "Recibirás un correo en cuanto haya respuesta — habitualmente en menos de 48h.",
      ctaLabel: "Ir a mi panel",
      ctaUrl: `${baseUrl}/trabaja-con-nosotros/registro`
    }),
    { event: "onboarding.submitted", taskerId: input.taskerUserId }
  );
}
