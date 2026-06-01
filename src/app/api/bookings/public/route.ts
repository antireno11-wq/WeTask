import { UserRole } from "@prisma/client";
import { safeErrorDetail } from "@/lib/logger";
import { NextRequest, NextResponse } from "next/server";
import { getRequestIdentity } from "@/lib/auth";
import { COVERAGE_UNAVAILABLE_MESSAGE, normalizeCommune } from "@/lib/communes";
import { prisma } from "@/lib/prisma";
import { publicBookingsQuerySchema, publicCreateBookingSchema } from "@/lib/validators";

export async function GET(req: NextRequest) {
  try {
    // BOOK-08: ya no se consulta por email arbitrario; exige sesión y devuelve sólo lo propio.
    const identity = getRequestIdentity(req);
    if (!identity.userId) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const searchParams = req.nextUrl.searchParams;
    const input = publicBookingsQuerySchema.parse({
      email: searchParams.get("email") ?? "placeholder@scoped.local",
      limit: searchParams.get("limit") ?? undefined
    });

    const bookings = await prisma.booking.findMany({
      where: { customerId: identity.userId },
      include: {
        service: { select: { id: true, name: true, slug: true } },
        pro: { select: { id: true, fullName: true } }
      },
      orderBy: [{ createdAt: "desc" }],
      take: input.limit
    });

    return NextResponse.json({ bookings }, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      {
        error: "No se pudieron listar tus reservas",
        detail: safeErrorDetail(error)
      },
      { status: 400 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    // BOOK-01: exige sesión y crea la reserva para el usuario autenticado.
    // Se eliminó el upsert por email, que permitía sobrescribir datos de cualquier usuario.
    const identity = getRequestIdentity(req);
    if (!identity.userId || !identity.role) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const body = await req.json();
    const input = publicCreateBookingSchema.parse(body);

    const service = await prisma.service.findUnique({ where: { id: input.serviceId } });

    if (!service || !service.isActive) {
      return NextResponse.json({ error: "Servicio no disponible" }, { status: 400 });
    }

    const customer = await prisma.user.findUnique({ where: { id: identity.userId } });
    if (!customer || customer.role === UserRole.PRO) {
      return NextResponse.json({ error: "Cuenta no válida para reservar" }, { status: 403 });
    }

    const booking = await prisma.booking.create({
      data: {
        customerId: customer.id,
        serviceId: input.serviceId,
        scheduledAt: input.scheduledAt,
        addressLine1: input.addressLine1.trim(),
        comuna: normalizeCommune(input.comuna) ?? input.comuna.trim(),
        region: input.region.trim(),
        notes: input.notes?.trim() || null,
        totalPriceClp: service.basePriceClp
      },
      include: {
        service: { select: { id: true, name: true, slug: true } }
      }
    });

    return NextResponse.json({ booking }, { status: 201 });
  } catch (error) {
    const rawMessage = error instanceof Error ? error.message : "";
    if (rawMessage.includes("Comuna fuera de cobertura MVP")) {
      return NextResponse.json({ error: COVERAGE_UNAVAILABLE_MESSAGE }, { status: 400 });
    }
    return NextResponse.json(
      {
        error: "No se pudo crear la reserva",
        detail: safeErrorDetail(error)
      },
      { status: 400 }
    );
  }
}
