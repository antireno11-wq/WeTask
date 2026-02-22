import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createBookingSchema } from "@/lib/validators";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const input = createBookingSchema.parse(body);

    const service = await prisma.service.findUnique({
      where: { id: input.serviceId }
    });

    if (!service || !service.isActive) {
      return NextResponse.json({ error: "Servicio no disponible" }, { status: 400 });
    }

    const booking = await prisma.booking.create({
      data: {
        customerId: input.customerId,
        serviceId: input.serviceId,
        scheduledAt: input.scheduledAt,
        addressLine1: input.addressLine1,
        comuna: input.comuna,
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
