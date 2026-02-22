import { UserRole } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { publicBookingsQuerySchema, publicCreateBookingSchema } from "@/lib/validators";

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const input = publicBookingsQuerySchema.parse({
      email: searchParams.get("email") ?? undefined,
      limit: searchParams.get("limit") ?? undefined
    });

    const email = input.email.trim().toLowerCase();

    const customer = await prisma.user.findUnique({ where: { email } });

    if (!customer) {
      return NextResponse.json({ bookings: [] }, { status: 200 });
    }

    const bookings = await prisma.booking.findMany({
      where: { customerId: customer.id },
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
        detail: error instanceof Error ? error.message : "Error desconocido"
      },
      { status: 400 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const input = publicCreateBookingSchema.parse(body);

    const service = await prisma.service.findUnique({ where: { id: input.serviceId } });

    if (!service || !service.isActive) {
      return NextResponse.json({ error: "Servicio no disponible" }, { status: 400 });
    }

    const normalizedEmail = input.email.trim().toLowerCase();

    const existingUser = await prisma.user.findUnique({ where: { email: normalizedEmail } });

    if (existingUser && existingUser.role === UserRole.PRO) {
      return NextResponse.json({ error: "Este correo ya pertenece a un prestador" }, { status: 400 });
    }

    const customer = await prisma.user.upsert({
      where: { email: normalizedEmail },
      update: {
        fullName: input.fullName.trim(),
        phone: input.phone?.trim() || null,
        role: UserRole.CUSTOMER
      },
      create: {
        email: normalizedEmail,
        fullName: input.fullName.trim(),
        phone: input.phone?.trim() || null,
        role: UserRole.CUSTOMER
      }
    });

    const booking = await prisma.booking.create({
      data: {
        customerId: customer.id,
        serviceId: input.serviceId,
        scheduledAt: input.scheduledAt,
        addressLine1: input.addressLine1.trim(),
        comuna: input.comuna.trim(),
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
    return NextResponse.json(
      {
        error: "No se pudo crear la reserva",
        detail: error instanceof Error ? error.message : "Error desconocido"
      },
      { status: 400 }
    );
  }
}
