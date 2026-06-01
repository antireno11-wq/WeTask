import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { safeErrorDetail } from "@/lib/logger";
import { prepareServiceRequest } from "@/lib/service-preparation";

export const dynamic = "force-dynamic";

const requestSchema = z.object({
  categorySlug: z.string().min(1),
  serviceSlug: z.string().optional().nullable(),
  cleaning: z
    .object({
      bedrooms: z.coerce.number().optional().nullable(),
      bathrooms: z.coerce.number().optional().nullable(),
      sizeBand: z.string().optional().nullable(),
      dirtLevel: z.string().optional().nullable(),
      occupancy: z.string().optional().nullable(),
      hasKitchen: z.boolean().optional(),
      hasLivingDining: z.boolean().optional(),
      extras: z.array(z.string()).optional()
    })
    .optional(),
  ironing: z
    .object({
      garments: z.coerce.number().optional().nullable(),
      bulkyItems: z.coerce.number().optional().nullable(),
      includesDelicates: z.boolean().optional()
    })
    .optional()
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const input = requestSchema.parse(body);
    const result = prepareServiceRequest(input);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: "No se pudo preparar el servicio", detail: safeErrorDetail(error) },
      { status: 400 }
    );
  }
}
