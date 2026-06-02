import { randomBytes } from "crypto";
import { UserRole } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { getRequestIdentity, hasRole } from "@/lib/auth";
import { getMercadoPagoAuthorizationUrl, isMercadoPagoOAuthConfigured } from "@/lib/payments/providers/mercadopago";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const STATE_TTL_MINUTES = 10;

export async function POST(req: NextRequest) {
  const identity = getRequestIdentity(req);
  if (!identity.userId || !hasRole(identity.role, [UserRole.PRO, UserRole.ADMIN])) {
    return NextResponse.json({ error: "Solo taskers o admin pueden conectar MercadoPago" }, { status: 403 });
  }

  if (!isMercadoPagoOAuthConfigured()) {
    return NextResponse.json(
      { error: "OAuth de MercadoPago no está configurado en el servidor" },
      { status: 503 }
    );
  }

  const state = randomBytes(24).toString("base64url");
  const expiresAt = new Date(Date.now() + STATE_TTL_MINUTES * 60 * 1000);

  await prisma.mercadoPagoOAuthState.create({
    data: {
      userId: identity.userId,
      state,
      expiresAt
    }
  });

  const authorizationUrl = getMercadoPagoAuthorizationUrl(state);

  return NextResponse.json({ authorizationUrl, expiresAt }, { status: 200 });
}
