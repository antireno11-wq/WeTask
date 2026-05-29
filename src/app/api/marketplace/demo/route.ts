import { NextResponse } from "next/server";
import { ensureMarketplaceDemoData } from "@/lib/marketplace-demo-data";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not Found" }, { status: 404 });
  }

  try {
    const seed = await ensureMarketplaceDemoData();

    if (!seed.customerId) {
      return NextResponse.json({
        customer: null,
        customers: [],
        professionals: [],
        admin: null,
        note: "Set SEED_DEMO_DATA=true to seed demo accounts."
      });
    }

    const [customer, customers, pros] = await Promise.all([
      seed.customerId
        ? prisma.user.findUnique({ where: { id: seed.customerId }, select: { id: true, fullName: true, email: true } })
        : Promise.resolve(null),
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
      })
    ]);

    return NextResponse.json({
      customer,
      customers,
      professionals: pros,
      admin: null
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
