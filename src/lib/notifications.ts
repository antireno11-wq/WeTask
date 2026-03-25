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
    console.warn("[email] skipped: resend not configured", {
      to: payload.to,
      subject: payload.subject,
      missing: config.missing
    });
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
    console.error("[email] resend delivery failed", {
      to: payload.to,
      subject: payload.subject,
      status: response.status,
      from: config.from,
      detail: cleanDetail
    });
    throw new Error(cleanDetail ? `No se pudo enviar correo (${response.status}): ${cleanDetail}` : `No se pudo enviar correo (${response.status})`);
  }

  const data = (await response.json().catch(() => null)) as { id?: string } | null;
  console.info("[email] sent", {
    to: payload.to,
    subject: payload.subject,
    from: config.from,
    emailId: data?.id ?? null
  });
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

export function buildVerificationEmailTemplate(payload: VerificationEmailTemplatePayload) {
  const safeAppUrl = payload.appUrl.replace(/\/+$/, "");
  const logoUrl = `${safeAppUrl}/logo-wetask.png`;

  return `
    <div style="margin:0;padding:32px 16px;background:#eef4fb;font-family:Arial,sans-serif;color:#17324d;">
      <div style="max-width:620px;margin:0 auto;background:#ffffff;border-radius:28px;overflow:hidden;box-shadow:0 18px 46px rgba(21,58,97,0.14);border:1px solid rgba(34,97,160,0.12);">
        <div style="padding:36px 36px 18px;background:linear-gradient(135deg,#173e73 0%,#1d7fc6 100%);text-align:center;">
          <img src="${logoUrl}" alt="WeTask" style="width:180px;max-width:100%;height:auto;display:inline-block;" />
        </div>
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
  const safeAppUrl = payload.appUrl.replace(/\/+$/, "");
  const logoUrl = `${safeAppUrl}/logo-wetask.png`;

  return `
    <div style="margin:0;padding:32px 16px;background:#eef4fb;font-family:Arial,sans-serif;color:#17324d;">
      <div style="max-width:620px;margin:0 auto;background:#ffffff;border-radius:28px;overflow:hidden;box-shadow:0 18px 46px rgba(21,58,97,0.14);border:1px solid rgba(34,97,160,0.12);">
        <div style="padding:36px 36px 18px;background:linear-gradient(135deg,#173e73 0%,#1d7fc6 100%);text-align:center;">
          <img src="${logoUrl}" alt="WeTask" style="width:180px;max-width:100%;height:auto;display:inline-block;" />
        </div>
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
