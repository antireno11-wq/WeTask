import { NextRequest, NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { getRequestIdentity } from "@/lib/auth";
import { COVERAGE_UNAVAILABLE_MESSAGE, normalizeCommune } from "@/lib/communes";
import { prisma } from "@/lib/prisma";
import { hasAssignedRole } from "@/lib/user-roles";
import { createBookingSchema, listBookingsQuerySchema } from "@/lib/validators";

export async function GET(req: NextRequest) {
  try {
    // BOOK-08: exige identidad y restringe la consulta al propio usuario (evita IDOR).
    const identity = getRequestIdentity(req);
    if (!identity.userId || !identity.role) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const searchParams = req.nextUrl.searchParams;
    const input = listBookingsQuerySchema.parse({
      customerId: searchParams.get("customerId") ?? undefined,
      proId: searchParams.get("proId") ?? undefined,
      status: searchParams.get("status") ?? undefined,
      limit: searchParams.get("limit") ?? undefined
    });

    const where =
      identity.role === UserRole.ADMIN
        ? { customerId: input.customerId, proId: input.proId, status: input.status }
        : identity.role === UserRole.PRO
          ? { proId: identity.userId, status: input.status }
          : { customerId: identity.userId, status: input.status };

    const bookings = await prisma.booking.findMany({
      where,
      include: {
        service: true,
        customer: { select: { id: true, fullName: true, email: true } },
        pro: { select: { id: true, fullName: true, email: true } }
      },
      orderBy: [{ createdAt: "desc" }],
      take: input.limit
    });

    return NextResponse.json({ bookings }, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      {
        error: "No se pudieron listar las reservas",
        detail: error instanceof Error ? error.message : "Error desconocido"
      },
      { status: 400 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    // BOOK-01: exige identidad; un no-admin sólo puede crear reservas para sí mismo.
    const identity = getRequestIdentity(req);
    if (!identity.userId || !identity.role) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const body = await req.json();
    const input = createBookingSchema.parse(body);

    if (identity.role !== UserRole.ADMIN && input.customerId !== identity.userId) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const [service, customer] = await Promise.all([
      prisma.service.findUnique({ where: { id: input.serviceId } }),
      prisma.user.findUnique({ where: { id: input.customerId }, include: { roleAssignments: { select: { role: { select: { code: true } } } } } })
    ]);

    if (!service || !service.isActive) {
      return NextResponse.json({ error: "Servicio no disponible" }, { status: 400 });
    }

    if (!customer || !hasAssignedRole(customer, UserRole.CUSTOMER)) {
      return NextResponse.json({ error: "Cliente no válido" }, { status: 400 });
    }

    const normalizedCommune = normalizeCommune(input.comuna);
    if (!normalizedCommune) {
      return NextResponse.json(
        { error: COVERAGE_UNAVAILABLE_MESSAGE },
        { status: 400 }
      );
    }

    const booking = await prisma.booking.create({
      data: {
        customerId: input.customerId,
        serviceId: input.serviceId,
        scheduledAt: input.scheduledAt,
        addressLine1: input.addressLine1,
        comuna: normalizedCommune,
        region: input.region,
        notes: input.notes,
        totalPriceClp: service.basePriceClp
      }
    });

    return NextResponse.json({ booking }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      {
        error: "No se pudo crear la reserva",
        detail: error instanceof Error ? error.message : "Error desconocido"
      },
      { status: 400 }
    );
  }
}
