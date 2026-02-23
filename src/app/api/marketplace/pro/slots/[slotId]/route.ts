import { UserRole } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { getRequestIdentity, hasRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { marketplaceProSlotUpdateSchema } from "@/lib/validators";

export const dynamic = "force-dynamic";

async function authorize(identity: { userId: string | null; role: UserRole | null }, slotId: string) {
  const slot = await prisma.availabilitySlot.findUnique({
    where: { id: slotId },
    include: { professionalProfile: { select: { userId: true } }, bookings: { select: { id: true, status: true } } }
  });

  if (!slot) return { error: "Slot no encontrado" } as const;
  if (identity.role === UserRole.PRO && identity.userId !== slot.professionalProfile.userId) {
    return { error: "No autorizado" } as const;
  }

  return { slot } as const;
}

export async function PATCH(req: NextRequest, context: { params: { slotId: string } }) {
  try {
    const identity = getRequestIdentity(req);
    if (!hasRole(identity.role, [UserRole.PRO, UserRole.ADMIN])) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const auth = await authorize(identity, context.params.slotId);
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.error === "Slot no encontrado" ? 404 : 403 });
    }

    const body = await req.json();
    const input = marketplaceProSlotUpdateSchema.parse(body);

    const hasActiveBooking = auth.slot.bookings.some((booking) => booking.status !== "CANCELLED");
    if (hasActiveBooking && input.isAvailable === false) {
      return NextResponse.json({ error: "No puedes desactivar un slot con reserva activa" }, { status: 409 });
    }

    const slot = await prisma.availabilitySlot.update({
      where: { id: context.params.slotId },
      data: { isAvailable: input.isAvailable },
      include: { service: { select: { id: true, name: true } } }
    });

    return NextResponse.json({ slot }, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      {
        error: "No se pudo actualizar slot",
        detail: error instanceof Error ? error.message : "Error desconocido"
      },
      { status: 400 }
    );
  }
}

export async function DELETE(req: NextRequest, context: { params: { slotId: string } }) {
  try {
    const identity = getRequestIdentity(req);
    if (!hasRole(identity.role, [UserRole.PRO, UserRole.ADMIN])) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const auth = await authorize(identity, context.params.slotId);
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.error === "Slot no encontrado" ? 404 : 403 });
    }

    const hasActiveBooking = auth.slot.bookings.some((booking) => booking.status !== "CANCELLED");
    if (hasActiveBooking) {
      return NextResponse.json({ error: "No puedes eliminar un slot con reserva activa" }, { status: 409 });
    }

    await prisma.availabilitySlot.delete({ where: { id: context.params.slotId } });
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      {
        error: "No se pudo eliminar slot",
        detail: error instanceof Error ? error.message : "Error desconocido"
      },
      { status: 400 }
    );
  }
}
