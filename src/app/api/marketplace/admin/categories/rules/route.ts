import { NextRequest, NextResponse } from "next/server";
import { requireAdminRequest } from "@/lib/admin-access";
import { recordAdminAction } from "@/lib/audit-log";
import { invalidateMarketplaceCatalog } from "@/lib/cache-tags";
import { prisma } from "@/lib/prisma";
import { marketplaceAdminFeeSchema } from "@/lib/validators";

export async function PATCH(req: NextRequest) {
  try {
    const admin = await requireAdminRequest(req);
    if (!admin.ok) return admin.response;

    const body = await req.json();
    const input = marketplaceAdminFeeSchema.parse(body);

    const result = await prisma.$transaction(async (tx) => {
      const before = await tx.category.findUnique({
        where: { id: input.categoryId },
        select: { id: true, slug: true, basePlatformFeePct: true, minHours: true, slotMinutes: true }
      });

      const category = await tx.category.update({
        where: { id: input.categoryId },
        data: {
          basePlatformFeePct: input.basePlatformFeePct,
          minHours: input.minHours,
          slotMinutes: input.slotMinutes
        }
      });

      await recordAdminAction(
        {
          actorId: admin.identity.userId,
          action: "category.update_rules",
          target: { type: "Category", id: category.id },
          before,
          after: {
            basePlatformFeePct: input.basePlatformFeePct,
            minHours: input.minHours,
            slotMinutes: input.slotMinutes
          }
        },
        tx
      );

      return category;
    });

    invalidateMarketplaceCatalog();

    return NextResponse.json({ category: result }, { status: 200 });
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
