import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getClientIp, rateLimit, tooManyRequestsResponse } from "@/lib/rate-limit";
import { serviceLeadCreateSchema } from "@/lib/validators";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    // 5/min por IP — evita spam de leads.
    const rl = await rateLimit("leads.create", getClientIp(req), "5/m");
    if (!rl.success) return tooManyRequestsResponse(rl) as unknown as NextResponse;

    const body = await req.json();
    const input = serviceLeadCreateSchema.parse(body);

    const lead = await prisma.serviceLead.create({
      data: {
        fullName: input.fullName.trim(),
        phone: input.phone.trim(),
        comuna: input.comuna.trim(),
        serviceNeeded: input.serviceNeeded.trim(),
        problemDescription: input.problemDescription.trim(),
        source: input.source?.trim() || "landing"
      }
    });

    return NextResponse.json({ ok: true, leadId: lead.id }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: "No se pudo registrar la solicitud",
        detail: error instanceof Error ? error.message : "Error desconocido"
      },
      { status: 400 }
    );
  }
}
