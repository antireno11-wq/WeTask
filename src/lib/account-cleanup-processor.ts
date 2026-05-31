import { logError, logger } from "@/lib/logger";
import { refreshMercadoPagoToken } from "@/lib/payments/providers/mercadopago";
import { prisma } from "@/lib/prisma";
import { decryptSecret, encryptSecretNullable } from "@/lib/token-encryption";

export type HardDeleteResult = {
  reviewed: number;
  anonymized: number;
  failed: number;
  users: Array<{ userId: string; anonymizedAt: Date }>;
};

/**
 * Procesa cuentas cuyo grace de eliminación venció (scheduledDeletionAt < now).
 *
 * **No borra la fila User** — la anonimiza. Las leyes tributarias chilenas
 * (DL 825 art. 58, Resolución Ex. 6 SII) obligan a conservar registros
 * contables 6 años. Borrar el User cascadea o rompe FK hacia Payment,
 * Booking y Review, perdiendo trazabilidad fiscal.
 *
 * Lo que sí borramos:
 * - Addresses (PII pura, no asociadas a Booking ya cerrado salvo via copia)
 * - PaymentMethods guardados (last4 ya se preserva en Payment por reserva)
 * - AuthSession + EmailVerificationToken + PasswordResetToken
 * - MercadoPagoOAuthState
 *
 * Lo que anonimizamos en User:
 * - fullName → "Usuario eliminado"
 * - email → `deleted-<id>@wetask.invalid`
 * - phone, birthDate, passwordHash, mpAccessToken, mpRefreshToken → null
 * - role queda igual; sirve para auditoría
 */
export async function hardDeleteExpiredAccounts(): Promise<HardDeleteResult> {
  const now = new Date();

  const expired = await prisma.user.findMany({
    where: {
      scheduledDeletionAt: { lt: now, not: null },
      deletedAt: { not: null }
      // No re-procesar cuentas ya anonimizadas: identificamos por email.invalid
    },
    select: { id: true, email: true },
    take: 100
  });

  const eligible = expired.filter((u) => !u.email.endsWith("@wetask.invalid"));

  const result: HardDeleteResult = {
    reviewed: expired.length,
    anonymized: 0,
    failed: 0,
    users: []
  };

  for (const user of eligible) {
    try {
      const anonymizedAt = new Date();
      const anonymousEmail = `deleted-${user.id}@wetask.invalid`;

      await prisma.$transaction(async (tx) => {
        // Borrar PII pura (datos sin valor contable)
        await tx.address.deleteMany({ where: { userId: user.id } });
        await tx.customerPaymentMethod.deleteMany({ where: { userId: user.id } });
        await tx.authSession.deleteMany({ where: { userId: user.id } });
        await tx.emailVerificationToken.deleteMany({ where: { userId: user.id } });
        await tx.passwordResetToken.deleteMany({ where: { userId: user.id } });
        await tx.mercadoPagoOAuthState.deleteMany({ where: { userId: user.id } });

        // Anonimizar User (mantener id, role, createdAt para auditoría y FK)
        await tx.user.update({
          where: { id: user.id },
          data: {
            email: anonymousEmail,
            fullName: "Usuario eliminado",
            phone: null,
            birthDate: null,
            passwordHash: null,
            mpAccessToken: null,
            mpRefreshToken: null,
            mpUserId: null,
            mpAccountStatus: "DELETED",
            mpConnectedAt: null,
            mpTokenExpiresAt: null,
            mercadoPagoCustomerId: null,
            termsAcceptedAt: null,
            termsVersionId: null,
            emailVerifiedAt: null
            // deletedAt y scheduledDeletionAt se mantienen como evidencia
          }
        });
      });

      result.anonymized += 1;
      result.users.push({ userId: user.id, anonymizedAt });
      logger.info({ userId: user.id, anonymizedAt }, "Cuenta anonimizada por hard-delete");
    } catch (err) {
      result.failed += 1;
      logError("account-cleanup.hard_delete", err, { userId: user.id });
    }
  }

  return result;
}

export type RefreshMpTokensResult = {
  reviewed: number;
  refreshed: number;
  failed: number;
  disabled: number;
  users: Array<{ userId: string; nextExpiresAt: Date | null; status: "refreshed" | "failed" | "disabled" }>;
};

const REFRESH_WINDOW_DAYS = 7;

/**
 * Refresca access tokens de MercadoPago que vencen en los próximos
 * REFRESH_WINDOW_DAYS días. Sin esto los pagos vía Marketplace fallan
 * silenciosamente cuando el token de un tasker aprobado expira.
 *
 * Si el refresh falla (token revocado, refresh expirado, etc.) marca
 * mpAccountStatus="DISABLED" para que el tasker no aparezca en búsqueda
 * y reciba notificación de reconectar.
 */
export async function refreshExpiringMpTokens(): Promise<RefreshMpTokensResult> {
  const cutoff = new Date(Date.now() + REFRESH_WINDOW_DAYS * 24 * 60 * 60 * 1000);

  const candidates = await prisma.user.findMany({
    where: {
      mpTokenExpiresAt: { lt: cutoff, not: null },
      mpRefreshToken: { not: null },
      mpAccountStatus: "ACTIVE"
    },
    select: { id: true, mpRefreshToken: true, mpTokenExpiresAt: true },
    take: 50
  });

  const result: RefreshMpTokensResult = {
    reviewed: candidates.length,
    refreshed: 0,
    failed: 0,
    disabled: 0,
    users: []
  };

  for (const user of candidates) {
    if (!user.mpRefreshToken) continue;
    try {
      // PAY-04: el refresh token está cifrado at-rest; se descifra para llamar a MP
      // y se vuelven a cifrar los tokens devueltos.
      const decryptedRefresh = decryptSecret(user.mpRefreshToken);
      if (!decryptedRefresh) continue;
      const refreshed = await refreshMercadoPagoToken(decryptedRefresh);
      const nextExpiresAt = refreshed.expiresInSeconds
        ? new Date(Date.now() + refreshed.expiresInSeconds * 1000)
        : null;

      await prisma.user.update({
        where: { id: user.id },
        data: {
          mpAccessToken: encryptSecretNullable(refreshed.accessToken),
          mpRefreshToken: encryptSecretNullable(refreshed.refreshToken) ?? user.mpRefreshToken,
          mpTokenExpiresAt: nextExpiresAt
        }
      });

      result.refreshed += 1;
      result.users.push({ userId: user.id, nextExpiresAt, status: "refreshed" });
      logger.info({ userId: user.id, nextExpiresAt }, "Token MP refrescado");
    } catch (err) {
      // Token no recuperable: marcar DISABLED + notificar al tasker.
      try {
        await prisma.user.update({
          where: { id: user.id },
          data: { mpAccountStatus: "DISABLED" }
        });
        await prisma.notification.create({
          data: {
            userId: user.id,
            title: "Reconectá tu cuenta MercadoPago",
            body: "Tu conexión con MercadoPago expiró. Reconecta desde tu panel para seguir recibiendo reservas."
          }
        });
        result.disabled += 1;
        result.users.push({ userId: user.id, nextExpiresAt: null, status: "disabled" });
        logError("account-cleanup.mp_refresh_disabled", err, { userId: user.id });
      } catch (innerErr) {
        result.failed += 1;
        result.users.push({ userId: user.id, nextExpiresAt: null, status: "failed" });
        logError("account-cleanup.mp_refresh_unrecoverable", innerErr, { userId: user.id });
      }
    }
  }

  return result;
}
