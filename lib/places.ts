import "server-only";
import { env } from "./env";
import { milesToMeters, type LatLng } from "./geo";

/** Shape of the fields we request from Places API (New). */
export type GooglePlace = {
  id: string;
  displayName?: { text: string };
  location?: { latitude: number; longitude: number };
  formattedAddress?: string;
  types?: string[];
  primaryType?: string;
  rating?: number;
  userRatingCount?: number;
  priceLevel?: string;
  editorialSummary?: { text: string };
  photos?: { name: string }[];
  websiteUri?: string;
  googleMapsUri?: string;
  regularOpeningHours?: { periods?: OpeningPeriod[] };
  utcOffsetMinutes?: number;
  businessStatus?: string;
};

export type OpeningPeriod = {
  open: { day: number; hour: number; minute: number };
  close?: { day: number; hour: number; minute: number };
};

// Only request what we use: the field mask decides which billing SKU applies.
const FIELD_MASK = [
  "id",
  "displayName",
  "location",
  "formattedAddress",
  "types",
  "primaryType",
  "rating",
  "userRatingCount",
  "priceLevel",
  "editorialSummary",
  "photos",
  "websiteUri",
  "googleMapsUri",
  "regularOpeningHours.periods",
  "utcOffsetMinutes",
  "businessStatus",
]
  .map((f) => `places.${f}`)
  .join(",");

/** Nearby Search never returns more than this; a full page means the tile may hold more. */
export const NEARBY_MAX_RESULTS = 20;

/** Rough USD cost per Nearby Search call with the fields above (Enterprise SKU). Used for estimates only. */
export const EST_COST_PER_REQUEST_USD = 0.035;

export class PlacesApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Nearby Search (New) for restaurants in one circle, retrying rate limits and server errors. */
export async function searchNearby(center: LatLng, radiusMi: number): Promise<GooglePlace[]> {
  const body = {
    includedTypes: ["restaurant"],
    maxResultCount: NEARBY_MAX_RESULTS,
    locationRestriction: {
      circle: {
        center: { latitude: center.lat, longitude: center.lng },
        // API maximum is 50 km.
        radius: Math.min(milesToMeters(radiusMi), 50_000),
      },
    },
  };

  for (let attempt = 0; ; attempt++) {
    const res = await fetch("https://places.googleapis.com/v1/places:searchNearby", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": env("GOOGLE_MAPS_API_KEY"),
        "X-Goog-FieldMask": FIELD_MASK,
      },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      const json = (await res.json()) as { places?: GooglePlace[] };
      return json.places ?? [];
    }
    const retryable = res.status === 429 || res.status >= 500;
    if (!retryable || attempt >= 4) {
      const text = await res.text();
      throw new PlacesApiError(`Places API ${res.status}: ${text.slice(0, 500)}`, res.status);
    }
    await sleep(500 * 2 ** attempt + Math.random() * 250);
  }
}

/** Address -> coordinates via the Geocoding API. */
export async function geocode(address: string): Promise<LatLng & { formatted: string }> {
  const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
  url.searchParams.set("address", address);
  url.searchParams.set("key", env("GOOGLE_MAPS_API_KEY"));
  const res = await fetch(url);
  const json = (await res.json()) as {
    status: string;
    error_message?: string;
    results: { formatted_address: string; geometry: { location: { lat: number; lng: number } } }[];
  };
  if (json.status === "ZERO_RESULTS") throw new Error(`No location found for "${address}"`);
  if (json.status !== "OK") throw new Error(`Geocoding failed: ${json.status} ${json.error_message ?? ""}`.trim());
  const top = json.results[0];
  return { ...top.geometry.location, formatted: top.formatted_address };
}

const PRICE_LEVELS: Record<string, number> = {
  PRICE_LEVEL_FREE: 0,
  PRICE_LEVEL_INEXPENSIVE: 1,
  PRICE_LEVEL_MODERATE: 2,
  PRICE_LEVEL_EXPENSIVE: 3,
  PRICE_LEVEL_VERY_EXPENSIVE: 4,
};

/** Convert a Places result into a `restaurants` row (categorization columns untouched). */
export function toRestaurantRow(p: GooglePlace) {
  return {
    place_id: p.id,
    name: p.displayName?.text ?? "Unnamed",
    lat: p.location!.latitude,
    lng: p.location!.longitude,
    address: p.formattedAddress ?? null,
    rating: p.rating ?? null,
    rating_count: p.userRatingCount ?? 0,
    price_level: p.priceLevel ? (PRICE_LEVELS[p.priceLevel] ?? null) : null,
    primary_type: p.primaryType ?? null,
    google_types: p.types ?? [],
    summary: p.editorialSummary?.text ?? null,
    photo_name: p.photos?.[0]?.name ?? null,
    website: p.websiteUri ?? null,
    maps_url: p.googleMapsUri ?? null,
    hours: p.regularOpeningHours?.periods ?? null,
    utc_offset_min: p.utcOffsetMinutes ?? null,
    fetched_at: new Date().toISOString(),
  };
}
