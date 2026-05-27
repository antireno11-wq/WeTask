import { UserRole } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { getRequestIdentity, hasRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateChileanTEFCsv } from "@/lib/payout-exporter";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const identity = getRequestIdentity(req);
    if (!hasRole(identity.role, UserRole.ADMIN)) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    // Fetch all payouts that are pending
    const payouts = await prisma.payout.findMany({
      where: {
        status: "PENDING"
      },
      include: {
        pro: {
          include: {
            cleaningOnboarding: true
          }
        }
      }
    });

    if (payouts.length === 0) {
      return NextResponse.json(
        { ok: false, message: "No hay transferencias (payouts) pendientes por exportar." },
        { status: 200 }
      );
    }

    // Generate CSV content
    const csvContent = generateChileanTEFCsv(payouts);

    // Update their status to PROCESSING in a database transaction to prevent double payout
    await prisma.$transaction(
      payouts.map((payout) =>
        prisma.payout.update({
          where: { id: payout.id },
          data: { status: "PROCESSING" }
        })
      )
    );

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    const filename = `wetask_payouts_tef_${timestamp}.csv`;

    // Return the CSV file for direct browser download
    const response = new NextResponse(csvContent, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`
      }
    });

    return response;
  } catch (error) {
    console.error("[export-tef-error]", error);
    return NextResponse.json(
      {
        error: "No se pudo exportar el lote bancario",
        detail: error instanceof Error ? error.message : "Error de base de datos"
      },
      { status: 500 }
    );
  }
}
