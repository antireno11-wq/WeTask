import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json(
      {
        ok: true,
        database: "connected",
        service: "wetask",
        timestamp: new Date().toISOString()
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Health check failed:", error);
    return NextResponse.json(
      {
        ok: false,
        database: "disconnected",
        service: "wetask",
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}

