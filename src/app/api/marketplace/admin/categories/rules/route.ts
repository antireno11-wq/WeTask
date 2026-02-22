import { UserRole } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { getRequestIdentity, hasRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { marketplaceAdminFeeSchema } from "@/lib/validators";

export async function PATCH(req: NextRequest) {
  try {
    const identity = getRequestIdentity(req);
    if (!hasRole(identity.role, UserRole.ADMIN)) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const body = await req.json();
    const input = marketplaceAdminFeeSchema.parse(body);

    const category = await prisma.category.update({
      where: { id: input.categoryId },
      data: {
        basePlatformFeePct: input.basePlatformFeePct,
        minHours: input.minHours,
        slotMinutes: input.slotMinutes
      }
    });

    return NextResponse.json({ category }, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      {
        error: "No se pudieron actualizar reglas de categoria",
        detail: error instanceof Error ? error.message : "Error desconocido"
      },
      { status: 400 }
    );
  }
}
