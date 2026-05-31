import { NextRequest, NextResponse } from "next/server";
import { logError } from "@/lib/logger";
import { exchangeMercadoPagoCode, isMercadoPagoOAuthConfigured } from "@/lib/payments/providers/mercadopago";
import { prisma } from "@/lib/prisma";
import { encryptSecretNullable } from "@/lib/token-encryption";

export const dynamic = "force-dynamic";

function redirectWith(req: NextRequest, target: string, query: Record<string, string>): NextResponse {
  const base = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/+$/, "") ?? new URL(req.url).origin;
  const url = new URL(target, base);
  for (const [key, value] of Object.entries(query)) {
    url.searchParams.set(key, value);
  }
  return NextResponse.redirect(url);
}

export async function GET(req: NextRequest) {
  if (!isMercadoPagoOAuthConfigured()) {
    return redirectWith(req, "/pro", { mpError: "not_configured" });
  }

  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  const errorParam = req.nextUrl.searchParams.get("error");

  if (errorParam) {
    return redirectWith(req, "/pro", { mpError: errorParam });
  }
  if (!code || !state) {
    return redirectWith(req, "/pro", { mpError: "missing_code_or_state" });
  }

  const stored = await prisma.mercadoPagoOAuthState.findUnique({ where: { state } });
  if (!stored) {
    return redirectWith(req, "/pro", { mpError: "invalid_state" });
  }
  if (stored.expiresAt.getTime() < Date.now()) {
    await prisma.mercadoPagoOAuthState.delete({ where: { id: stored.id } }).catch(() => null);
    return redirectWith(req, "/pro", { mpError: "expired_state" });
  }

  let tokenResponse;
  try {
    tokenResponse = await exchangeMercadoPagoCode(code);
  } catch (error) {
    logError("mp-oauth.exchange", error, { stateId: stored.id });
    await prisma.mercadoPagoOAuthState.delete({ where: { id: stored.id } }).catch(() => null);
    return redirectWith(req, "/pro", { mpError: "exchange_failed" });
  }

  const expiresAt = tokenResponse.expiresInSeconds
    ? new Date(Date.now() + tokenResponse.expiresInSeconds * 1000)
    : null;

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: stored.userId },
      data: {
        // PAY-04: tokens cifrados at-rest (AES-256-GCM).
        mpAccessToken: encryptSecretNullable(tokenResponse.accessToken),
        mpRefreshToken: encryptSecretNullable(tokenResponse.refreshToken),
        mpUserId: tokenResponse.userId,
        mpTokenExpiresAt: expiresAt,
        mpAccountStatus: "ACTIVE",
        mpConnectedAt: new Date()
      }
    });
    await tx.mercadoPagoOAuthState.delete({ where: { id: stored.id } });
  });

  return redirectWith(req, "/pro", { mpConnected: "true" });
}
