/** Types and helpers shared by client components (no server imports). */

export type Card = {
  place_id: string;
  name: string;
  rating: number | null;
  rating_count: number;
  price_level: number | null;
  cuisine: string | null;
  tags: string[];
  distance_mi: number;
  address: string | null;
  summary: string | null;
  photo_name: string | null;
  website: string | null;
  maps_url: string | null;
  score: number;
  reasons: string[];
  explore: boolean;
};

export type FilterOption = { value: string; label: string; count: number };

export type Filters = {
  cuisine: string | null;
  tags: string[];
  maxPrice: number | null;
  openNow: boolean;
  includePassed: boolean;
};

export const EMPTY_FILTERS: Filters = { cuisine: null, tags: [], maxPrice: null, openNow: false, includePassed: false };

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
  ) {
    super(message);
  }
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: init?.body ? { "Content-Type": "application/json", ...init.headers } : init?.headers,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(json.error ?? `Request failed (${res.status})`, res.status, json.code);
  return json as T;
}

export const photoUrl = (name: string) => `/api/photo?name=${encodeURIComponent(name)}`;

export function priceLabel(level: number | null) {
  if (level === null) return null;
  return level === 0 ? "Free" : "$".repeat(level);
}

export const mapsUrl = (c: { maps_url: string | null; place_id: string; name: string }) =>
  c.maps_url ?? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(c.name)}&query_place_id=${c.place_id}`;

export const labelOf = (slug: string) =>
  slug
    .split("-")
    .map((w) => (w === "bbq" ? "BBQ" : w[0].toUpperCase() + w.slice(1)))
    .join(" ");
