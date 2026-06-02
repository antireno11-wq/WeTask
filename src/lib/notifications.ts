import { logger } from "@/lib/logger";

type EmailPayload = {
  to: string;
  subject: string;
  text: string;
  html?: string;
};

type EmailDeliveryConfig = {
  configured: boolean;
  apiKey?: string;
  from?: string;
  missing: string[];
};

export function getEmailDeliveryConfig(): EmailDeliveryConfig {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.RESEND_FROM_EMAIL?.trim();
  const missing = [
    !apiKey ? "RESEND_API_KEY" : null,
    !from ? "RESEND_FROM_EMAIL" : null
  ].filter((item): item is string => Boolean(item));

  return {
    configured: missing.length === 0,
    apiKey,
    from,
    missing
  };
}

export async function sendPlatformEmail(payload: EmailPayload): Promise<void> {
  const config = getEmailDeliveryConfig();

  if (!config.configured || !config.apiKey || !config.from) {
    logger.warn(
      { to: payload.to, subject: payload.subject, missing: config.missing },
      "email skipped: resend not configured"
    );
    return;
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from: config.from,
      to: [payload.to],
      subject: payload.subject,
      text: payload.text,
      html: payload.html
    })
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    const cleanDetail = detail.replace(/\s+/g, " ").trim();
    logger.error(
      { to: payload.to, subject: payload.subject, status: response.status, from: config.from, detail: cleanDetail },
      "email resend delivery failed"
    );
    throw new Error(cleanDetail ? `No se pudo enviar correo (${response.status}): ${cleanDetail}` : `No se pudo enviar correo (${response.status})`);
  }

  const data = (await response.json().catch(() => null)) as { id?: string } | null;
  logger.info(
    { to: payload.to, subject: payload.subject, from: config.from, emailId: data?.id ?? null },
    "email sent"
  );
}

type VerificationEmailTemplatePayload = {
  fullName: string;
  verifyUrl: string;
  code: string;
  appUrl: string;
};

type PasswordResetEmailTemplatePayload = {
  fullName: string;
  resetUrl: string;
  appUrl: string;
};

function buildEmailBrandHeader() {
  return `
    <div style="padding:36px 36px 18px;background:linear-gradient(135deg,#173e73 0%,#1d7fc6 100%);text-align:center;">
      <div style="display:inline-flex;align-items:center;gap:12px;padding:12px 18px;border-radius:999px;background:rgba(255,255,255,0.12);border:1px solid rgba(216,236,255,0.26);">
        <span style="display:inline-flex;align-items:center;justify-content:center;width:34px;height:34px;border-radius:12px;background:linear-gradient(180deg,#76f2c0 0%,#3ec0e8 100%);box-shadow:inset 0 1px 0 rgba(255,255,255,0.35);">
          <span style="display:block;width:16px;height:16px;border-radius:6px 6px 10px 10px;transform:rotate(45deg);background:#ffffff;"></span>
        </span>
        <span style="font-size:28px;line-height:1;font-weight:900;letter-spacing:-0.03em;color:#ffffff;">WeTask</span>
      </div>
      <div style="margin-top:12px;font-size:14px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:#d8ecff;">WeTask</div>
    </div>
  `;
}

export function buildVerificationEmailTemplate(payload: VerificationEmailTemplatePayload) {
  return `
    <div style="margin:0;padding:32px 16px;background:#eef4fb;font-family:Arial,sans-serif;color:#17324d;">
      <div style="max-width:620px;margin:0 auto;background:#ffffff;border-radius:28px;overflow:hidden;box-shadow:0 18px 46px rgba(21,58,97,0.14);border:1px solid rgba(34,97,160,0.12);">
        ${buildEmailBrandHeader()}
        <div style="padding:32px 36px 36px;">
          <p style="margin:0 0 14px;font-size:14px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#1d7fc6;">Verificación de cuenta</p>
          <h1 style="margin:0 0 16px;font-size:28px;line-height:1.12;color:#17324d;">Confirma tu correo en WeTask</h1>
          <p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:#48627d;">Hola ${payload.fullName}, ya casi está lista tu cuenta. Usa este código o el botón de abajo para verificar tu correo y activar tu acceso.</p>
          <div style="margin:22px 0;padding:18px 20px;border-radius:22px;background:#f4f8fd;border:1px solid rgba(29,127,198,0.18);text-align:center;">
            <p style="margin:0 0 8px;font-size:13px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#1d7fc6;">Código de verificación</p>
            <p style="margin:0;font-size:34px;line-height:1;font-weight:900;letter-spacing:.2em;color:#173e73;">${payload.code}</p>
          </div>
          <p style="margin:0 0 24px;font-size:14px;line-height:1.6;color:#5f7691;">Si prefieres, también puedes verificar tu cuenta tocando este botón:</p>
          <div style="text-align:center;margin:0 0 24px;">
            <a href="${payload.verifyUrl}" style="display:inline-block;padding:14px 24px;border-radius:999px;background:linear-gradient(135deg,#173e73 0%,#1d7fc6 100%);color:#ffffff;text-decoration:none;font-weight:800;">Verificar mi correo</a>
          </div>
          <p style="margin:0 0 10px;font-size:13px;line-height:1.6;color:#5f7691;">Si el botón no funciona, copia y pega este enlace en tu navegador:</p>
          <p style="margin:0;font-size:13px;line-height:1.6;word-break:break-all;color:#1d7fc6;">${payload.verifyUrl}</p>
        </div>
      </div>
    </div>
  `;
}

export function buildPasswordResetEmailTemplate(payload: PasswordResetEmailTemplatePayload) {
  return `
    <div style="margin:0;padding:32px 16px;background:#eef4fb;font-family:Arial,sans-serif;color:#17324d;">
      <div style="max-width:620px;margin:0 auto;background:#ffffff;border-radius:28px;overflow:hidden;box-shadow:0 18px 46px rgba(21,58,97,0.14);border:1px solid rgba(34,97,160,0.12);">
        ${buildEmailBrandHeader()}
        <div style="padding:32px 36px 36px;">
          <p style="margin:0 0 14px;font-size:14px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#1d7fc6;">Recuperación de contraseña</p>
          <h1 style="margin:0 0 16px;font-size:28px;line-height:1.12;color:#17324d;">Cambia tu contraseña en WeTask</h1>
          <p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:#48627d;">Hola ${payload.fullName}, recibimos una solicitud para restablecer tu contraseña. Usa el botón de abajo para crear una nueva clave.</p>
          <div style="text-align:center;margin:24px 0;">
            <a href="${payload.resetUrl}" style="display:inline-block;padding:14px 24px;border-radius:999px;background:linear-gradient(135deg,#173e73 0%,#1d7fc6 100%);color:#ffffff;text-decoration:none;font-weight:800;">Restablecer contraseña</a>
          </div>
          <p style="margin:0 0 10px;font-size:13px;line-height:1.6;color:#5f7691;">Este enlace vence en 30 minutos. Si no pediste este cambio, puedes ignorar este correo.</p>
          <p style="margin:0;font-size:13px;line-height:1.6;word-break:break-all;color:#1d7fc6;">${payload.resetUrl}</p>
        </div>
      </div>
    </div>
  `;
}

type AdminTaskerReviewEmailTemplatePayload = {
  taskerName: string;
  taskerEmail: string;
  categoryLabel: string;
  commune: string;
  reviewUrl: string;
};

type TaskerStatusEmailTemplatePayload = {
  fullName: string;
  title: string;
  message: string;
  ctaLabel: string;
  ctaUrl: string;
};

export function buildAdminTaskerReviewEmailTemplate(payload: AdminTaskerReviewEmailTemplatePayload) {
  return `
    <div style="margin:0;padding:32px 16px;background:#eef4fb;font-family:Arial,sans-serif;color:#17324d;">
      <div style="max-width:620px;margin:0 auto;background:#ffffff;border-radius:28px;overflow:hidden;box-shadow:0 18px 46px rgba(21,58,97,0.14);border:1px solid rgba(34,97,160,0.12);">
        <div style="padding:28px 32px 18px;background:linear-gradient(135deg,#173e73 0%,#1d7fc6 100%);">
          <p style="margin:0;font-size:13px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:#d8ecff;">Nuevo tasker para revisión</p>
          <h1 style="margin:10px 0 0;font-size:28px;line-height:1.12;color:#ffffff;">Hay un perfil esperando validación</h1>
        </div>
        <div style="padding:28px 32px 32px;">
          <p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:#48627d;">
            Un nuevo tasker terminó su onboarding y quedó listo para revisión manual en WeTask.
          </p>
          <div style="display:grid;gap:10px;margin:0 0 24px;padding:18px 20px;border-radius:20px;background:#f4f8fd;border:1px solid rgba(29,127,198,0.18);">
            <p style="margin:0;"><strong>Nombre:</strong> ${payload.taskerName}</p>
            <p style="margin:0;"><strong>Email:</strong> ${payload.taskerEmail}</p>
            <p style="margin:0;"><strong>Categoría:</strong> ${payload.categoryLabel}</p>
            <p style="margin:0;"><strong>Comuna base:</strong> ${payload.commune}</p>
          </div>
          <div style="text-align:center;">
            <a href="${payload.reviewUrl}" style="display:inline-block;padding:14px 24px;border-radius:999px;background:linear-gradient(135deg,#173e73 0%,#1d7fc6 100%);color:#ffffff;text-decoration:none;font-weight:800;">
              Abrir cola de revisión
            </a>
          </div>
        </div>
      </div>
    </div>
  `;
}

type GenericTransactionalEmailPayload = {
  fullName: string;
  title: string;
  intro: string;
  bullets?: Array<{ label: string; value: string }>;
  body?: string;
  ctaLabel?: string;
  ctaUrl?: string;
};

/**
 * Template genérico transaccional reusable: header con brand, título,
 * intro, opcional lista de bullets (key/value), opcional body extra, CTA.
 * Lo usamos para confirmaciones de booking, recordatorios, payout
 * liberado y reseña recibida — mantiene una sola estructura visual.
 */
export function buildGenericTransactionalEmail(payload: GenericTransactionalEmailPayload) {
  const bulletsHtml = payload.bullets?.length
    ? `<div style="margin:18px 0;padding:16px 20px;border-radius:18px;background:#f4f8fd;border:1px solid rgba(29,127,198,0.18);">
        ${payload.bullets
          .map(
            (item) =>
              `<p style="margin:4px 0;font-size:14px;color:#48627d;"><strong style="color:#17324d;">${item.label}:</strong> ${item.value}</p>`
          )
          .join("")}
       </div>`
    : "";

  const ctaHtml =
    payload.ctaUrl && payload.ctaLabel
      ? `<div style="text-align:center;margin:24px 0 0;">
          <a href="${payload.ctaUrl}" style="display:inline-block;padding:14px 24px;border-radius:999px;background:linear-gradient(135deg,#173e73 0%,#1d7fc6 100%);color:#ffffff;text-decoration:none;font-weight:800;">${payload.ctaLabel}</a>
        </div>`
      : "";

  const bodyHtml = payload.body
    ? `<p style="margin:16px 0 0;font-size:15px;line-height:1.7;color:#48627d;">${payload.body}</p>`
    : "";

  return `
    <div style="margin:0;padding:32px 16px;background:#eef4fb;font-family:Arial,sans-serif;color:#17324d;">
      <div style="max-width:620px;margin:0 auto;background:#ffffff;border-radius:28px;overflow:hidden;box-shadow:0 18px 46px rgba(21,58,97,0.14);border:1px solid rgba(34,97,160,0.12);">
        ${buildEmailBrandHeader()}
        <div style="padding:32px 36px 36px;">
          <h1 style="margin:0 0 14px;font-size:24px;line-height:1.2;color:#17324d;">${payload.title}</h1>
          <p style="margin:0 0 12px;font-size:16px;line-height:1.6;color:#48627d;">Hola ${payload.fullName},</p>
          <p style="margin:0;font-size:16px;line-height:1.7;color:#48627d;">${payload.intro}</p>
          ${bulletsHtml}
          ${bodyHtml}
          ${ctaHtml}
        </div>
      </div>
    </div>
  `;
}

export function buildBookingConfirmedTemplate(payload: {
  fullName: string;
  bookingId: string;
  serviceName: string;
  scheduledAt: string;
  address: string;
  totalClp: number;
  ctaUrl: string;
  role: "CUSTOMER" | "PRO";
}) {
  const isCustomer = payload.role === "CUSTOMER";
  return buildGenericTransactionalEmail({
    fullName: payload.fullName,
    title: isCustomer ? "Tu reserva está confirmada" : "Recibiste una reserva nueva",
    intro: isCustomer
      ? "Tu pago se procesó correctamente y la reserva quedó confirmada. Te avisamos cuando el profesional esté en camino."
      : "Un cliente reservó tu servicio y el pago ya quedó retenido en MercadoPago. Prepárate para la fecha pactada.",
    bullets: [
      { label: "Servicio", value: payload.serviceName },
      { label: "Fecha", value: payload.scheduledAt },
      { label: "Dirección", value: payload.address },
      { label: "Monto", value: `$${payload.totalClp.toLocaleString("es-CL")}` }
    ],
    ctaLabel: isCustomer ? "Ver mi reserva" : "Ver detalles",
    ctaUrl: payload.ctaUrl
  });
}

export function buildBookingReminderTemplate(payload: {
  fullName: string;
  serviceName: string;
  scheduledAt: string;
  address: string;
  hoursUntil: number;
  ctaUrl: string;
  role: "CUSTOMER" | "PRO";
}) {
  const isCustomer = payload.role === "CUSTOMER";
  return buildGenericTransactionalEmail({
    fullName: payload.fullName,
    title: payload.hoursUntil === 1 ? "Tu servicio empieza pronto" : "Recordatorio: tu servicio es mañana",
    intro: isCustomer
      ? `Te recordamos que tu servicio empieza en aproximadamente ${payload.hoursUntil} hora(s).`
      : `Recordá que tenés que llegar a la dirección en aproximadamente ${payload.hoursUntil} hora(s).`,
    bullets: [
      { label: "Servicio", value: payload.serviceName },
      { label: "Hora", value: payload.scheduledAt },
      { label: "Dirección", value: payload.address }
    ],
    ctaLabel: isCustomer ? "Ver detalles" : "Ir a la reserva",
    ctaUrl: payload.ctaUrl
  });
}

export function buildPayoutReleasedTemplate(payload: {
  fullName: string;
  bookingId: string;
  amountClp: number;
  ctaUrl: string;
}) {
  return buildGenericTransactionalEmail({
    fullName: payload.fullName,
    title: "Tu pago fue liberado",
    intro: `Tu pago por la reserva ${payload.bookingId} ya está disponible en tu cuenta de MercadoPago.`,
    bullets: [
      { label: "Monto neto", value: `$${payload.amountClp.toLocaleString("es-CL")}` },
      { label: "Reserva", value: payload.bookingId }
    ],
    body: "Tarda hasta 48h hábiles en aparecer reflejado en tu banco según las reglas de MercadoPago.",
    ctaLabel: "Ver mis pagos",
    ctaUrl: payload.ctaUrl
  });
}

export function buildReviewReceivedTemplate(payload: {
  fullName: string;
  rating: number;
  comment: string | null;
  customerName: string;
  serviceName: string;
  ctaUrl: string;
}) {
  return buildGenericTransactionalEmail({
    fullName: payload.fullName,
    title: "Recibiste una nueva reseña",
    intro: `${payload.customerName} dejó una reseña sobre ${payload.serviceName}.`,
    bullets: [
      { label: "Puntaje", value: `${payload.rating} / 5 estrellas` },
      ...(payload.comment ? [{ label: "Comentario", value: payload.comment }] : [])
    ],
    ctaLabel: "Ver mi perfil público",
    ctaUrl: payload.ctaUrl
  });
}

export function buildTaskerStatusEmailTemplate(payload: TaskerStatusEmailTemplatePayload) {
  return `
    <div style="margin:0;padding:32px 16px;background:#eef4fb;font-family:Arial,sans-serif;color:#17324d;">
      <div style="max-width:620px;margin:0 auto;background:#ffffff;border-radius:28px;overflow:hidden;box-shadow:0 18px 46px rgba(21,58,97,0.14);border:1px solid rgba(34,97,160,0.12);">
        <div style="padding:28px 32px 18px;background:linear-gradient(135deg,#173e73 0%,#1d7fc6 100%);">
          <p style="margin:0;font-size:13px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:#d8ecff;">Actualización de tu perfil</p>
          <h1 style="margin:10px 0 0;font-size:28px;line-height:1.12;color:#ffffff;">${payload.title}</h1>
        </div>
        <div style="padding:28px 32px 32px;">
          <p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:#48627d;">Hola ${payload.fullName},</p>
          <p style="margin:0 0 24px;font-size:16px;line-height:1.7;color:#48627d;">${payload.message}</p>
          <div style="text-align:center;">
            <a href="${payload.ctaUrl}" style="display:inline-block;padding:14px 24px;border-radius:999px;background:linear-gradient(135deg,#173e73 0%,#1d7fc6 100%);color:#ffffff;text-decoration:none;font-weight:800;">
              ${payload.ctaLabel}
            </a>
          </div>
        </div>
      </div>
    </div>
  `;
}
