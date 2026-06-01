import { NextRequest, NextResponse } from "next/server";
import { getClientIp, rateLimit, tooManyRequestsResponse } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    // ADM-01: endpoint facturable de Google y público (se usa en páginas pre-login).
    // Lo protegemos con un rate-limit por IP para evitar abuso de cuota / factura ilimitada.
    const rl = await rateLimit("maps.autocomplete", getClientIp(request), "30/m");
    if (!rl.success) return tooManyRequestsResponse(rl) as unknown as NextResponse;

    const input = request.nextUrl.searchParams.get("input")?.trim() ?? "";
    if (input.length < 3) {
      return NextResponse.json({ predictions: [] }, { status: 200 });
    }

    const apiKey = process.env.GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ predictions: [], skipped: true }, { status: 200 });
    }

    const endpoint = new URL("https://maps.googleapis.com/maps/api/place/autocomplete/json");
    endpoint.searchParams.set("input", input);
    endpoint.searchParams.set("key", apiKey);
    endpoint.searchParams.set("components", "country:cl");
    endpoint.searchParams.set("language", "es");
    endpoint.searchParams.set("types", "address");

    const response = await fetch(endpoint.toString(), { cache: "no-store" });
    const payload = (await response.json()) as {
      status?: string;
      error_message?: string;
      predictions?: Array<{ description?: string }>;
    };

    if (!response.ok) {
      return NextResponse.json({ error: `Google Places error (${response.status})` }, { status: 502 });
    }

    if (payload.status === "ZERO_RESULTS") {
      return NextResponse.json({ predictions: [] }, { status: 200 });
    }

    if (payload.status !== "OK") {
      return NextResponse.json(
        { error: payload.error_message || "No se pudo consultar sugerencias de dirección en Google." },
        { status: 502 }
      );
    }

    const predictions = (payload.predictions ?? [])
      .map((item) => item.description?.trim())
      .filter((value): value is string => Boolean(value))
      .slice(0, 6);

    return NextResponse.json({ predictions }, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { error: "Error obteniendo sugerencias de dirección." },
      { status: 500 }
    );
  }
}
