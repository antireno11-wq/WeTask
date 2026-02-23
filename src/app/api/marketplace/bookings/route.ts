import { UserRole } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { getRequestIdentity, hasRole } from "@/lib/auth";
import { calculateMarketplacePrice } from "@/lib/marketplace-pricing";
import { prisma } from "@/lib/prisma";
import { marketplaceCreateBookingSchema } from "@/lib/validators";

export async function GET(req: NextRequest) {
  try {
    const identity = getRequestIdentity(req);

    if (!hasRole(identity.role, UserRole.ADMIN)) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const limit = Number(req.nextUrl.searchParams.get("limit") ?? "30");

    const bookings = await prisma.booking.findMany({
      orderBy: [{ createdAt: "desc" }],
      take: Number.isNaN(limit) ? 30 : Math.min(Math.max(limit, 1), 100),
      include: {
        customer: { select: { id: true, fullName: true, email: true } },
        pro: { select: { id: true, fullName: true, email: true } },
        service: { select: { id: true, name: true } },
        extras: true,
        payment: true
      }
    });

    return NextResponse.json({ bookings }, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      {
        error: "No se pudieron listar reservas marketplace",
        detail: error instanceof Error ? error.message : "Error desconocido"
      },
      { status: 400 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const identity = getRequestIdentity(req);
    if (!hasRole(identity.role, [UserRole.CUSTOMER, UserRole.ADMIN])) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const body = await req.json();
    const input = marketplaceCreateBookingSchema.parse(body);

    if (identity.role === UserRole.CUSTOMER && identity.userId !== input.customerId) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const [customer, service] = await Promise.all([
      prisma.user.findUnique({ where: { id: input.customerId } }),
      prisma.service.findUnique({ where: { id: input.serviceId }, include: { category: true } })
    ]);

    if (!customer || customer.role !== UserRole.CUSTOMER) {
      return NextResponse.json({ error: "Cliente no valido" }, { status: 400 });
    }

    if (!service || !service.isActive || !service.category) {
      return NextResponse.json({ error: "Servicio no disponible o sin categoria configurada" }, { status: 400 });
    }

    if (input.hours < service.category.minHours) {
      return NextResponse.json(
        { error: `La categoria exige minimo ${service.category.minHours} hora(s)` },
        { status: 400 }
      );
    }

    const requestedSlotMinutes = service.category.slotMinutes;
    const baseRate = service.basePriceClp;
    const platformFeePct = Number(service.category.basePlatformFeePct);

    let assignedProId = input.proId ?? null;
    let selectedSlotId = input.slotId ?? null;

    if (selectedSlotId) {
      const selectedSlot = await prisma.availabilitySlot.findUnique({
        where: { id: selectedSlotId },
        include: { professionalProfile: true }
      });

      if (!selectedSlot || !selectedSlot.isAvailable) {
        return NextResponse.json({ error: "Horario no disponible" }, { status: 409 });
      }

      if (selectedSlot.startsAt.getTime() !== input.startsAt.getTime()) {
        return NextResponse.json({ error: "La hora seleccionada no coincide con el bloque" }, { status: 400 });
      }

      if (selectedSlot.serviceId && selectedSlot.serviceId !== input.serviceId) {
        return NextResponse.json({ error: "El bloque no pertenece al servicio seleccionado" }, { status: 400 });
      }

      assignedProId = selectedSlot.professionalProfile.userId;
    } else if (input.autoAssign && !assignedProId) {
      const candidate = await prisma.availabilitySlot.findFirst({
        where: {
          isAvailable: true,
          startsAt: { lte: input.startsAt },
          endsAt: { gte: new Date(input.startsAt.getTime() + input.hours * 60 * 60 * 1000) },
          OR: [{ serviceId: null }, { serviceId: input.serviceId }],
          professionalProfile: {
            isVerified: true,
            user: { role: UserRole.PRO }
          }
        },
        orderBy: [{ startsAt: "asc" }],
        include: { professionalProfile: true }
      });

      assignedProId = candidate?.professionalProfile.userId ?? null;
      selectedSlotId = candidate?.id ?? null;
    }

    if (assignedProId) {
      const pro = await prisma.user.findUnique({ where: { id: assignedProId } });
      if (!pro || pro.role !== UserRole.PRO) {
        return NextResponse.json({ error: "Profesional no valido" }, { status: 400 });
      }
    }

    const price = calculateMarketplacePrice({
      hourlyRateClp: baseRate,
      hours: input.hours,
      materials: Boolean(input.extras?.materials),
      urgency: Boolean(input.extras?.urgency),
      travelFeeClp: input.extras?.travelFeeClp ?? 0,
      materialFeeDefaultClp: service.category.materialFeeDefaultClp,
      urgencyFeeClp: service.category.urgencyFeeClp,
      platformFeePct
    });

    const address = await prisma.address.create({
      data: {
        userId: customer.id,
        street: input.address.street,
        city: input.address.city,
        postalCode: input.address.postalCode,
        region: input.address.region,
        country: "ES"
      }
    });

    const booking = await prisma.booking.create({
      data: {
        customerId: customer.id,
        proId: assignedProId,
        bookedSlotId: selectedSlotId,
        serviceId: input.serviceId,
        addressId: address.id,
        status: assignedProId ? "ASSIGNED" : "CREATED",
        scheduledAt: input.startsAt,
        addressLine1: input.address.street,
        comuna: input.address.city,
        region: input.address.region ?? "N/A",
        city: input.address.city,
        postalCode: input.address.postalCode,
        notes: input.details,
        hours: input.hours,
        slotMinutes: requestedSlotMinutes,
        autoAssign: input.autoAssign,
        hourlyPriceClp: price.hourlyRateClp,
        subtotalClp: price.subtotalClp,
        extrasTotalClp: price.extrasTotalClp,
        platformFeeClp: price.platformFeeClp,
        totalPriceClp: price.totalClp,
        paymentStatus: "PENDING",
        extras: {
          create: price.extras.map((item) => ({
            code: item.code,
            name: item.name,
            priceClp: item.priceClp,
            quantity: 1
          }))
        },
        payment: {
          create: {
            provider: "STRIPE",
            amountClp: price.totalClp,
            platformFeeClp: price.platformFeeClp,
            status: "PENDING"
          }
        }
      },
      include: {
        service: { select: { id: true, name: true } },
        customer: { select: { id: true, fullName: true, email: true } },
        pro: { select: { id: true, fullName: true } },
        extras: true,
        payment: true
      }
    });

    return NextResponse.json({ booking }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      {
        error: "No se pudo crear la reserva marketplace",
        detail: error instanceof Error ? error.message : "Error desconocido"
      },
      { status: 400 }
    );
  }
}
