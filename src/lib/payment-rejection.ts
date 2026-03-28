const PAYMENT_REJECTION_LABELS: Record<string, string> = {
  cc_rejected_bad_filled_card_number: "Número de tarjeta inválido.",
  cc_rejected_bad_filled_date: "Fecha de vencimiento inválida.",
  cc_rejected_bad_filled_other: "Revisa los datos de la tarjeta.",
  cc_rejected_bad_filled_security_code: "Código de seguridad inválido.",
  cc_rejected_blacklist: "Pago rechazado por seguridad.",
  cc_rejected_call_for_authorize: "Tarjeta rechazada por el emisor. Pide autorización al banco o usa otra tarjeta.",
  cc_rejected_card_disabled: "La tarjeta está deshabilitada.",
  cc_rejected_duplicated_payment: "Mercado Pago detectó un pago duplicado.",
  cc_rejected_high_risk: "Pago rechazado por validación de seguridad.",
  cc_rejected_insufficient_amount: "Fondos insuficientes en la tarjeta.",
  cc_rejected_invalid_installments: "La cantidad de cuotas no es válida para esta tarjeta.",
  cc_rejected_max_attempts: "Se alcanzó el máximo de intentos permitidos con esta tarjeta.",
  cc_rejected_other_reason: "Tarjeta rechazada por el emisor.",
  invalid_card_token: "Token de tarjeta inválido.",
  invalid_payment_method: "Medio de pago inválido.",
  invalid_issuer_id: "Banco emisor inválido.",
  invalid_installments: "La cantidad de cuotas no es válida.",
  invalid_card_number: "Número de tarjeta inválido.",
  invalid_security_code: "Código de seguridad inválido.",
  invalid_expiration_date: "Fecha de vencimiento inválida."
};

function prettifyCode(value: string) {
  return value
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function sentenceCase(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "";
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}

export function formatPaymentRejectionReason(input: {
  errorCode?: string | null;
  errorMessage?: string | null;
  providerStatus?: string | null;
}) {
  const rawCode = input.errorCode?.trim() || input.errorMessage?.trim() || input.providerStatus?.trim() || "";
  const normalized = rawCode.toLowerCase();
  const friendly =
    PAYMENT_REJECTION_LABELS[normalized] ||
    (input.errorMessage && input.errorMessage.trim() && input.errorMessage !== input.errorCode
      ? sentenceCase(input.errorMessage)
      : normalized
        ? sentenceCase(prettifyCode(normalized))
        : "");

  return {
    friendly: friendly || null,
    rawCode: rawCode || null
  };
}
