import { Payout, User, CleaningOnboarding } from "@prisma/client";

type PayoutWithRecipient = Payout & {
  pro: User & {
    cleaningOnboarding: CleaningOnboarding | null;
  };
};

export type TEFRow = {
  rut: string;
  name: string;
  email: string;
  bankName: string;
  accountType: string;
  accountNumber: string;
  amountClp: number;
  description: string;
};

// Map database account type identifiers to standard Chilean bank TEF names
function formatAccountType(type: string | null | undefined): string {
  if (!type) return "Cuenta Corriente";
  const normalized = type.toLowerCase().trim();
  switch (normalized) {
    case "cuenta_corriente":
      return "Cuenta Corriente";
    case "cuenta_vista":
    case "cuenta_rut":
      return "Cuenta Vista";
    case "cuenta_ahorro":
      return "Cuenta Ahorro";
    default:
      return "Cuenta Corriente";
  }
}

function cleanRut(rut: string | null): string {
  if (!rut) return "";
  return rut.replace(/\./g, "").replace(/-/g, "").trim().toUpperCase();
}

export function generateChileanTEFCsv(payouts: PayoutWithRecipient[]): string {
  const headers = [
    "Rut Destinatario",
    "Nombre Destinatario",
    "Email Destinatario",
    "Banco Destinatario",
    "Tipo Cuenta",
    "Nro Cuenta",
    "Monto Transferencia",
    "Detalle / Referencia"
  ];

  const rows = payouts.map((payout) => {
    const onboarding = payout.pro.cleaningOnboarding;
    const name = onboarding?.bankAccountHolder || payout.pro.fullName;
    const rawRut = onboarding?.bankAccountHolderRut || onboarding?.bankAccountHolderRut || "";
    const rut = cleanRut(rawRut);
    const email = payout.pro.email;
    const bankName = onboarding?.bankName || "BancoEstado";
    const accountType = formatAccountType(onboarding?.bankAccountType);
    const accountNumber = onboarding?.bankAccountNumber || "";
    const amount = payout.amountClp;
    const description = `WeTask Pago Reserva ${payout.bookingId}`;

    return [
      rut,
      name.replace(/,/g, " ").trim(), // Remove commas to prevent CSV breakage
      email.trim(),
      bankName.replace(/,/g, " ").trim(),
      accountType,
      accountNumber.replace(/'/g, "").trim(), // Ensure no formatting ticks
      amount,
      description
    ];
  });

  const csvContent = [
    headers.join(","),
    ...rows.map((row) => row.join(","))
  ].join("\r\n"); // Standard Windows CRLF line ending for bank readers

  return csvContent;
}
