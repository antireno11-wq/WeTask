import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const address = request.nextUrl.searchParams.get("address")?.trim();

    if (!address) {
      return NextResponse.json({ valid: false, error: "Ingresa una direccion para validar." }, { status: 400 });
    }

    const apiKey = process.env.GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { valid: false, error: "Falta configurar GOOGLE_MAPS_API_KEY en el servidor." },
        { status: 500 }
      );
    }

    const endpoint = new URL("https://maps.googleapis.com/maps/api/geocode/json");
    endpoint.searchParams.set("address", address);
    endpoint.searchParams.set("key", apiKey);
    endpoint.searchParams.set("region", "cl");
    endpoint.searchParams.set("language", "es");

    const response = await fetch(endpoint.toString(), { cache: "no-store" });
    const payload = (await response.json()) as {
      status?: string;
      results?: Array<{ formatted_address?: string; geometry?: { location?: { lat?: number; lng?: number } } }>;
      error_message?: string;
    };

    if (!response.ok || payload.status !== "OK" || !payload.results?.length) {
      return NextResponse.json(
        { valid: false, error: payload.error_message || "No pudimos validar esa direccion en Google Maps." },
        { status: 400 }
      );
    }

    const first = payload.results[0];

    return NextResponse.json(
      {
        valid: true,
        normalizedAddress: first.formatted_address ?? address,
        location: {
          lat: first.geometry?.location?.lat ?? null,
          lng: first.geometry?.location?.lng ?? null
        }
      },
      { status: 200 }
    );
  } catch (error) {
    return NextResponse.json(
      { valid: false, error: error instanceof Error ? error.message : "Error validando direccion." },
      { status: 500 }
    );
  }
}
