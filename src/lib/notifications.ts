type EmailPayload = {
  to: string;
  subject: string;
  text: string;
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
      text: payload.text
    })
  });
}
