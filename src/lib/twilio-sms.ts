type TwilioSmsResult =
  | { ok: true; sid: string }
  | { ok: false; reason: "not_configured" | "invalid_phone" | "request_failed"; detail?: string };

type SendTwilioSmsInput = {
  to: string;
  body: string;
};

function digitsOnly(value: string) {
  return value.replace(/\D/g, "");
}

export function normalizeChileanPhoneToE164(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  if (trimmed.startsWith("+")) {
    const normalized = `+${digitsOnly(trimmed)}`;
    return normalized.length >= 10 ? normalized : null;
  }

  let digits = digitsOnly(trimmed);
  if (!digits) return null;

  // Local common formats: 9XXXXXXXX, 09XXXXXXXX, 56XXXXXXXXX
  if (digits.startsWith("0")) {
    digits = digits.slice(1);
  }

  if (digits.startsWith("56")) {
    const asE164 = `+${digits}`;
    return asE164.length >= 11 ? asE164 : null;
  }

  if (digits.length === 9 || digits.length === 8) {
    return `+56${digits}`;
  }

  return null;
}

export async function sendTwilioSms(input: SendTwilioSmsInput): Promise<TwilioSmsResult> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID?.trim();
  const authToken = process.env.TWILIO_AUTH_TOKEN?.trim();
  const fromNumber = process.env.TWILIO_FROM_NUMBER?.trim();
  const messagingServiceSid = process.env.TWILIO_MESSAGING_SERVICE_SID?.trim();

  if (!accountSid || !authToken || (!fromNumber && !messagingServiceSid)) {
    return { ok: false, reason: "not_configured" };
  }

  const to = normalizeChileanPhoneToE164(input.to);
  if (!to) {
    return { ok: false, reason: "invalid_phone", detail: "Telefono invalido. Usa formato chileno (+56 9 ...)." };
  }

  const endpoint = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
  const form = new URLSearchParams({
    To: to,
    Body: input.body
  });

  if (messagingServiceSid) {
    form.set("MessagingServiceSid", messagingServiceSid);
  } else if (fromNumber) {
    form.set("From", fromNumber);
  }

  const basicAuth = Buffer.from(`${accountSid}:${authToken}`).toString("base64");
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basicAuth}`,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: form.toString(),
    cache: "no-store"
  });

  const payload = (await response.json()) as { sid?: string; message?: string };
  if (!response.ok || !payload.sid) {
    return {
      ok: false,
      reason: "request_failed",
      detail: payload.message || `Twilio error (${response.status})`
    };
  }

  return { ok: true, sid: payload.sid };
}
