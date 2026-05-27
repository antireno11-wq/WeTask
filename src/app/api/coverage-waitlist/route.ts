import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { normalizeCommune } from "@/lib/communes";
import { prisma } from "@/lib/prisma";
import { getClientIp, rateLimit, tooManyRequestsResponse } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

const createCoverageWaitlistSchema = z.object({
  email: z.string().email(),
  commune: z.string().min(2).max(120).optional(),
  address: z.string().min(3).max(260).optional(),
  source: z.string().min(2).max(120).optional()
});

export async function POST(req: NextRequest) {
  try {
    const rl = await rateLimit("coverage.waitlist", getClientIp(req), "5/m");
    if (!rl.success) return tooManyRequestsResponse(rl) as unknown as NextResponse;

    const body = await req.json();
    const input = createCoverageWaitlistSchema.parse(body);
    const email = input.email.trim().toLowerCase();
    const commune = normalizeCommune(input.commune) ?? input.commune?.trim() ?? null;
    const address = input.address?.trim() || null;

    const lead = await prisma.coverageWaitlist.create({
      data: {
        email,
        commune,
        address,
        source: input.source?.trim() || "coverage_gate"
      }
    });

    return NextResponse.json({ ok: true, leadId: lead.id }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: "No se pudo registrar tu interés de cobertura",
        detail: error instanceof Error ? error.message : "Error desconocido"
      },
      { status: 400 }
    );
  }
}
