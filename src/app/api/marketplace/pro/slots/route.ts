import { UserRole } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { getRequestIdentity, hasRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { marketplaceProSlotCreateSchema } from "@/lib/validators";

export const dynamic = "force-dynamic";

function resolveTargetProId(req: NextRequest, identity: { userId: string | null; role: UserRole | null }, bodyProId?: string) {
  const queryProId = req.nextUrl.searchParams.get("proId") ?? undefined;
  const targetProId = bodyProId ?? queryProId ?? identity.userId ?? undefined;
  if (!targetProId) return { error: "proId requerido" };
  if (identity.role === UserRole.PRO && identity.userId !== targetProId) return { error: "No autorizado" };
  return { targetProId };
}

export async function GET(req: NextRequest) {
  try {
    const identity = getRequestIdentity(req);
    if (!hasRole(identity.role, [UserRole.PRO, UserRole.ADMIN])) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const resolved = resolveTargetProId(req, identity);
    if ("error" in resolved) return NextResponse.json({ error: resolved.error }, { status: resolved.error === "No autorizado" ? 403 : 400 });

    const from = req.nextUrl.searchParams.get("from");
    const to = req.nextUrl.searchParams.get("to");
    const days = Number(req.nextUrl.searchParams.get("days") ?? "14");
    const limit = Math.min(Math.max(Number(req.nextUrl.searchParams.get("limit") ?? "200"), 1), 500);

    const start = from ? new Date(from) : new Date();
    const end = to ? new Date(to) : new Date(start.getTime() + Math.max(1, Math.min(days, 60)) * 24 * 60 * 60 * 1000);

    const profile = await prisma.professionalProfile.findUnique({ where: { userId: resolved.targetProId }, select: { id: true } });
    if (!profile) return NextResponse.json({ slots: [] }, { status: 200 });

    const slots = await prisma.availabilitySlot.findMany({
      where: {
        professionalProfileId: profile.id,
        startsAt: { gte: start },
        endsAt: { lte: end }
      },
      include: {
        service: { select: { id: true, name: true } },
        bookings: { select: { id: true, status: true }, take: 1 }
      },
      orderBy: [{ startsAt: "asc" }],
      take: limit
    });

    return NextResponse.json({ slots }, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      {
        error: "No se pudieron listar horarios",
        detail: error instanceof Error ? error.message : "Error desconocido"
      },
      { status: 400 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const identity = getRequestIdentity(req);
    if (!hasRole(identity.role, [UserRole.PRO, UserRole.ADMIN])) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const body = await req.json();
    const input = marketplaceProSlotCreateSchema.parse(body);
    const resolved = resolveTargetProId(req, identity, input.proId ?? undefined);
    if ("error" in resolved) return NextResponse.json({ error: resolved.error }, { status: resolved.error === "No autorizado" ? 403 : 400 });

    if (input.endsAt <= input.startsAt) {
      return NextResponse.json({ error: "endsAt debe ser mayor a startsAt" }, { status: 400 });
    }

    const slotDurationMs = input.endsAt.getTime() - input.startsAt.getTime();
    if (slotDurationMs < 30 * 60 * 1000 || slotDurationMs > 8 * 60 * 60 * 1000) {
      return NextResponse.json({ error: "Duracion de slot invalida" }, { status: 400 });
    }

    const profile = await prisma.professionalProfile.findUnique({ where: { userId: resolved.targetProId }, select: { id: true } });
    if (!profile) {
      return NextResponse.json({ error: "Debes completar tu perfil profesional primero" }, { status: 400 });
    }

    if (input.serviceId) {
      const service = await prisma.service.findUnique({ where: { id: input.serviceId }, select: { id: true, isActive: true } });
      if (!service || !service.isActive) {
        return NextResponse.json({ error: "Servicio no valido" }, { status: 400 });
      }
    }

    const overlap = await prisma.availabilitySlot.findFirst({
      where: {
        professionalProfileId: profile.id,
        startsAt: { lt: input.endsAt },
        endsAt: { gt: input.startsAt }
      },
      select: { id: true }
    });

    if (overlap) {
      return NextResponse.json({ error: "Ya existe un bloque en ese rango horario" }, { status: 409 });
    }

    const slot = await prisma.availabilitySlot.create({
      data: {
        professionalProfileId: profile.id,
        serviceId: input.serviceId ?? null,
        startsAt: input.startsAt,
        endsAt: input.endsAt,
        isAvailable: true
      },
      include: { service: { select: { id: true, name: true } } }
    });

    return NextResponse.json({ slot }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      {
        error: "No se pudo crear horario",
        detail: error instanceof Error ? error.message : "Error desconocido"
      },
      { status: 400 }
    );
  }
}
