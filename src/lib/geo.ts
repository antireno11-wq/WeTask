import { getCommuneCenter, inferCommuneFromAddress, normalizeCommune } from "@/lib/communes";

export type Coordinates = { lat: number; lng: number };

const cityCenters: Record<string, Coordinates> = {
  madrid: { lat: 40.4168, lng: -3.7038 },
  barcelona: { lat: 41.3874, lng: 2.1686 },
  valencia: { lat: 39.4699, lng: -0.3763 },
  sevilla: { lat: 37.3891, lng: -5.9845 },
  bilbao: { lat: 43.263, lng: -2.935 },
  malaga: { lat: 36.7213, lng: -4.4217 },
  zaragoza: { lat: 41.6488, lng: -0.8891 },
  santiago: { lat: -33.4489, lng: -70.6693 }
};

function hashToOffset(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i += 1) {
    h = (h * 31 + seed.charCodeAt(i)) % 100000;
  }
  return (h / 100000 - 0.5) * 0.16;
}

export function geocodeAddress(input: {
  city: string;
  postalCode?: string;
  street?: string;
  commune?: string;
  fallback?: Coordinates;
}): Coordinates {
  const cityKey = input.city.trim().toLowerCase();
  const detectedCommune = normalizeCommune(input.commune) ?? inferCommuneFromAddress(input.street ?? "");
  const communeCenter = getCommuneCenter(detectedCommune);
  const center = communeCenter ?? cityCenters[cityKey] ?? input.fallback ?? cityCenters.madrid;

  const seed = `${input.postalCode ?? ""}-${input.street ?? ""}-${cityKey}`;
  const latOffset = hashToOffset(`lat-${seed}`);
  const lngOffset = hashToOffset(`lng-${seed}`);

  return {
    lat: center.lat + latOffset,
    lng: center.lng + lngOffset
  };
}

export function distanceKm(a: Coordinates, b: Coordinates): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLon = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;

  const sinDLat = Math.sin(dLat / 2);
  const sinDLon = Math.sin(dLon / 2);

  const h = sinDLat * sinDLat + Math.cos(lat1) * Math.cos(lat2) * sinDLon * sinDLon;
  const c = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));

  return R * c;
}
