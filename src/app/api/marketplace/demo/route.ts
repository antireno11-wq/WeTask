import { NextResponse } from "next/server";
import { ensureMarketplaceDemoData } from "@/lib/marketplace-demo-data";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const seed = await ensureMarketplaceDemoData();

    const [customer, customers, pros, admin] = await Promise.all([
      prisma.user.findUnique({ where: { id: seed.customerId }, select: { id: true, fullName: true, email: true } }),
      prisma.user.findMany({
        where: { role: "CUSTOMER", email: { contains: "demo" } },
        select: { id: true, fullName: true, email: true },
        orderBy: { email: "asc" },
        take: 6
      }),
      prisma.user.findMany({
        where: { role: "PRO", email: { contains: "pro." } },
        select: { id: true, fullName: true, email: true },
        take: 6
      }),
      prisma.user.findFirst({
        where: { role: "ADMIN", email: "admin-demo@wetask.cl" },
        select: { id: true, fullName: true, email: true }
      })
    ]);

    return NextResponse.json({
      customer,
      customers,
      professionals: pros,
      admin
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "No se pudo cargar demo",
        detail: error instanceof Error ? error.message : "Error desconocido"
      },
      { status: 400 }
    );
  }
}
