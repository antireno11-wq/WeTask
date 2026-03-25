import { NextRequest, NextResponse } from "next/server";
import { requireAdminRequest } from "@/lib/admin-access";
import { getEmailDeliveryConfig } from "@/lib/notifications";

export const dynamic = "force-dynamic";

function maskEmail(value: string | undefined) {
  if (!value) return null;
  const match = value.match(/<([^>]+)>/);
  const email = (match ? match[1] : value).trim().toLowerCase();
  const [local, domain] = email.split("@");
  if (!local || !domain) return value;
  const visibleLocal = local.length <= 2 ? `${local[0] ?? ""}*` : `${local.slice(0, 2)}***`;
  return `${visibleLocal}@${domain}`;
}

export async function GET(req: NextRequest) {
  const admin = await requireAdminRequest(req);
  if (!admin.ok) return admin.response;

  const config = getEmailDeliveryConfig();
  return NextResponse.json(
    {
      provider: "resend",
      configured: config.configured,
      missing: config.missing,
      fromEmail: maskEmail(config.from)
    },
    { status: 200 }
  );
}
