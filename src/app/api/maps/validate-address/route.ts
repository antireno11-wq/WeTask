import { NextRequest, NextResponse } from "next/server";
import { inferCommuneFromAddress, isActiveMvpCommune, normalizeCommune } from "@/lib/communes";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const address = request.nextUrl.searchParams.get("address")?.trim();

    if (!address) {
      return NextResponse.json({ valid: false, error: "Ingresa una direccion para validar." }, { status: 400 });
    }

    const apiKey = process.env.GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      // Fallback no bloqueante para ambientes sin API key configurada.
      return NextResponse.json(
        {
          valid: true,
          skipped: true,
          normalizedAddress: address,
          commune: inferCommuneFromAddress(address),
          isActiveCommune: isActiveMvpCommune(inferCommuneFromAddress(address)),
          location: { lat: null, lng: null }
        },
        { status: 200 }
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
      results?: Array<{
        formatted_address?: string;
        geometry?: { location?: { lat?: number; lng?: number } };
        address_components?: Array<{ long_name?: string; short_name?: string; types?: string[] }>;
      }>;
      error_message?: string;
    };

    if (!response.ok || payload.status !== "OK" || !payload.results?.length) {
      return NextResponse.json(
        { valid: false, error: payload.error_message || "No pudimos validar esa direccion en Google Maps." },
        { status: 400 }
      );
    }

    const first = payload.results[0];
    const localityComponent = first.address_components?.find((component) =>
      Array.isArray(component.types) &&
      component.types.some((type) => type === "administrative_area_level_3" || type === "locality" || type === "sublocality")
    );
    const normalizedAddress = first.formatted_address ?? address;
    const communeFromComponents = normalizeCommune(localityComponent?.long_name ?? localityComponent?.short_name ?? "");
    const commune = communeFromComponents ?? inferCommuneFromAddress(normalizedAddress);

    return NextResponse.json(
      {
        valid: true,
        normalizedAddress,
        commune,
        isActiveCommune: isActiveMvpCommune(commune),
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
