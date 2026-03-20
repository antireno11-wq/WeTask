type EmailPayload = {
  to: string;
  subject: string;
  text: string;
  html?: string;
};

export async function sendPlatformEmail(payload: EmailPayload): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;

  if (!apiKey || !from) {
    console.warn("Email skipped: RESEND_API_KEY or RESEND_FROM_EMAIL not configured", {
      to: payload.to,
      subject: payload.subject
    });
    return;
  }

  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from,
      to: [payload.to],
      subject: payload.subject,
      text: payload.text,
      html: payload.html
    })
  });
}

type VerificationEmailTemplatePayload = {
  fullName: string;
  verifyUrl: string;
  code: string;
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
