import { UserRole } from "@prisma/client";
import { safeErrorDetail } from "@/lib/logger";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getRequestIdentity, hasRole } from "@/lib/auth";
import {
  createMercadoPagoCustomerCard,
  deleteMercadoPagoCustomerCard,
  ensureMercadoPagoCustomer
} from "@/lib/payments/providers/mercadopago";
import { prisma } from "@/lib/prisma";
import { hasAssignedRole } from "@/lib/user-roles";

export const dynamic = "force-dynamic";

const createPaymentMethodSchema = z.object({
  token: z.string().min(6),
  paymentMethodId: z.preprocess((value) => (typeof value === "string" && value.trim().length === 0 ? undefined : value), z.string().min(2).optional()),
  issuerId: z.preprocess((value) => (typeof value === "string" && value.trim().length === 0 ? undefined : value), z.string().optional()),
  payerEmail: z.string().email().optional(),
  cardholderName: z.string().min(2).max(120).optional(),
  makeDefault: z.boolean().optional().default(false)
});

const deletePaymentMethodSchema = z.object({
  id: z.string().min(1)
});

const patchPaymentMethodSchema = z.object({
  id: z.string().min(1),
  makeDefault: z.boolean().optional().default(false)
});

function splitFullName(fullName: string) {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 1) return { firstName: parts[0] ?? fullName, lastName: null };
  return {
    firstName: parts.slice(0, -1).join(" "),
    lastName: parts.slice(-1).join(" ")
  };
}

async function ensureCustomerUser(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      fullName: true,
      role: true,
      mercadoPagoCustomerId: true,
      roleAssignments: { select: { role: { select: { code: true } } } },
      paymentMethods: {
        orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
        select: {
          id: true,
          providerCustomerId: true,
          providerCardId: true,
          paymentMethodId: true,
          brand: true,
          last4: true,
          expirationMonth: true,
          expirationYear: true,
          cardholderName: true,
          payerEmail: true,
          isDefault: true,
          createdAt: true
        }
      }
    }
  });

  if (!user || !hasAssignedRole(user, UserRole.CUSTOMER)) {
    throw new Error("Cliente no válido");
  }

  return user;
}

export async function GET(req: NextRequest) {
  const identity = getRequestIdentity(req);
  if (!hasRole(identity.role, [UserRole.CUSTOMER, UserRole.ADMIN]) || !identity.userId) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  try {
    const user = await ensureCustomerUser(identity.userId);
    return NextResponse.json(
      {
        paymentMethods: user.paymentMethods.map((item) => ({
          id: item.id,
          brand: item.brand,
          last4: item.last4,
          expirationMonth: item.expirationMonth,
          expirationYear: item.expirationYear,
          cardholderName: item.cardholderName,
          payerEmail: item.payerEmail,
          paymentMethodId: item.paymentMethodId,
          // Necesario para re-tokenizar la tarjeta guardada con CVV en el checkout
          // (modelo marketplace: el token se genera fresco y se cobra en la cuenta del pro).
          providerCardId: item.providerCardId,
          isDefault: item.isDefault
        }))
      },
      { status: 200 }
    );
  } catch (error) {
    return NextResponse.json(
      { error: "No se pudieron cargar los medios de pago", detail: safeErrorDetail(error) },
      { status: 400 }
    );
  }
}

export async function POST(req: NextRequest) {
  const identity = getRequestIdentity(req);
  if (!hasRole(identity.role, [UserRole.CUSTOMER, UserRole.ADMIN]) || !identity.userId) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const input = createPaymentMethodSchema.parse(body);
    const user = await ensureCustomerUser(identity.userId);
    const { firstName, lastName } = splitFullName(user.fullName);
    const customerId = await ensureMercadoPagoCustomer({
      email: input.payerEmail ?? user.email,
      firstName,
      lastName,
      existingCustomerId: user.mercadoPagoCustomerId
    });

    if (customerId !== user.mercadoPagoCustomerId) {
      await prisma.user.update({
        where: { id: user.id },
        data: { mercadoPagoCustomerId: customerId }
      });
    }

    const storedCard = await createMercadoPagoCustomerCard({
      customerId,
      token: input.token,
      paymentMethodId: input.paymentMethodId,
      issuerId: input.issuerId
    });

    const shouldBeDefault = input.makeDefault || user.paymentMethods.length === 0;
    const saved = await prisma.$transaction(async (tx) => {
      if (shouldBeDefault) {
        await tx.customerPaymentMethod.updateMany({
          where: { userId: user.id },
          data: { isDefault: false }
        });
      }

      return tx.customerPaymentMethod.upsert({
        where: { providerCardId: storedCard.cardId },
        update: {
          providerCustomerId: storedCard.customerId,
          paymentMethodId: storedCard.paymentMethodId,
          brand: storedCard.brand,
          last4: storedCard.last4,
          expirationMonth: storedCard.expirationMonth,
          expirationYear: storedCard.expirationYear,
          cardholderName: input.cardholderName ?? storedCard.cardholderName,
          payerEmail: input.payerEmail ?? user.email,
          isDefault: shouldBeDefault
        },
        create: {
          userId: user.id,
          providerCustomerId: storedCard.customerId,
          providerCardId: storedCard.cardId,
          paymentMethodId: storedCard.paymentMethodId,
          brand: storedCard.brand,
          last4: storedCard.last4,
          expirationMonth: storedCard.expirationMonth,
          expirationYear: storedCard.expirationYear,
          cardholderName: input.cardholderName ?? storedCard.cardholderName,
          payerEmail: input.payerEmail ?? user.email,
          isDefault: shouldBeDefault
        }
      });
    });

    return NextResponse.json(
      {
        paymentMethod: {
          id: saved.id,
          brand: saved.brand,
          last4: saved.last4,
          expirationMonth: saved.expirationMonth,
          expirationYear: saved.expirationYear,
          cardholderName: saved.cardholderName,
          payerEmail: saved.payerEmail,
          paymentMethodId: saved.paymentMethodId,
          isDefault: saved.isDefault
        }
      },
      { status: 201 }
    );
  } catch (error) {
    return NextResponse.json(
      { error: "No se pudo guardar la tarjeta", detail: safeErrorDetail(error) },
      { status: 400 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  const identity = getRequestIdentity(req);
  if (!hasRole(identity.role, [UserRole.CUSTOMER, UserRole.ADMIN]) || !identity.userId) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const input = patchPaymentMethodSchema.parse(body);
    const paymentMethod = await prisma.customerPaymentMethod.findFirst({
      where: { id: input.id, userId: identity.userId }
    });
    if (!paymentMethod) {
      return NextResponse.json({ error: "Medio de pago no encontrado" }, { status: 404 });
    }

    await prisma.$transaction([
      prisma.customerPaymentMethod.updateMany({
        where: { userId: identity.userId },
        data: { isDefault: false }
      }),
      prisma.customerPaymentMethod.update({
        where: { id: paymentMethod.id },
        data: { isDefault: true }
      })
    ]);

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { error: "No se pudo actualizar el medio de pago", detail: safeErrorDetail(error) },
      { status: 400 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  const identity = getRequestIdentity(req);
  if (!hasRole(identity.role, [UserRole.CUSTOMER, UserRole.ADMIN]) || !identity.userId) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }
  const userId = identity.userId;

  try {
    const body = await req.json();
    const input = deletePaymentMethodSchema.parse(body);
    const paymentMethod = await prisma.customerPaymentMethod.findFirst({
      where: { id: input.id, userId: identity.userId }
    });
    if (!paymentMethod) {
      return NextResponse.json({ error: "Medio de pago no encontrado" }, { status: 404 });
    }

    await deleteMercadoPagoCustomerCard(paymentMethod.providerCustomerId, paymentMethod.providerCardId);

    await prisma.$transaction(async (tx) => {
      await tx.customerPaymentMethod.delete({ where: { id: paymentMethod.id } });
      if (paymentMethod.isDefault) {
        const fallback = await tx.customerPaymentMethod.findFirst({
          where: { userId },
          orderBy: { createdAt: "asc" }
        });
        if (fallback) {
          await tx.customerPaymentMethod.update({
            where: { id: fallback.id },
            data: { isDefault: true }
          });
        }
      }
    });

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { error: "No se pudo eliminar el medio de pago", detail: safeErrorDetail(error) },
      { status: 400 }
    );
  }
}
