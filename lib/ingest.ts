import "server-only";
import { haversineMiles, type LatLng } from "./geo";
import {
  EST_COST_PER_REQUEST_USD,
  NEARBY_MAX_RESULTS,
  searchNearby,
  toRestaurantRow,
  type GooglePlace,
} from "./places";
import { db } from "./supabase";
import { buildTiles, chooseTileRadius, subdivideTile, type Tile } from "./tiling";

/** Don't split tiles below this radius; a 0.5 mi circle still holding 20+ restaurants is downtown. */
export const MIN_TILE_RADIUS_MI = 0.5;
/** Hard cap on Google calls per sweep (cost guard). 60 calls is roughly $2. */
export const DEFAULT_MAX_REQUESTS = 60;
/** A finished sweep near the same origin is reused for this long (Google caching limits are ~30 days). */
export const SWEEP_REUSE_DAYS = 30;

const CONCURRENCY = 5;

export type SweepOptions = {
  origin: LatLng;
  radiusMi: number;
  /** Fixed tile size; by default it is chosen so the first pass fits the request budget. */
  tileRadiusMi?: number;
  maxRequests?: number;
};

export type SweepProgress = { tilesTotal: number; requestsMade: number; placesFound: number };

function initialTiles(opts: SweepOptions) {
  const maxRequests = opts.maxRequests ?? DEFAULT_MAX_REQUESTS;
  const tileRadiusMi = opts.tileRadiusMi ?? chooseTileRadius(opts.radiusMi, maxRequests);
  return { tiles: buildTiles(opts.origin, opts.radiusMi, tileRadiusMi), tileRadiusMi, maxRequests };
}

/** Estimate the cost of a sweep before running it. Subdivision can add calls up to maxRequests. */
export function estimateSweep(opts: SweepOptions) {
  const { tiles, tileRadiusMi, maxRequests } = initialTiles(opts);
  return {
    initialTiles: tiles.length,
    tileRadiusMi,
    maxRequests,
    minCostUsd: tiles.length * EST_COST_PER_REQUEST_USD,
    maxCostUsd: Math.max(tiles.length, maxRequests) * EST_COST_PER_REQUEST_USD,
  };
}

/**
 * Query every tile, splitting tiles that come back full (20 results), until the request
 * cap is hit. Tiles are processed breadth-first so a capped sweep still covers the whole
 * area at coarse resolution. Returns unique, operating restaurants inside the radius.
 */
export async function sweep(
  opts: SweepOptions,
  onProgress?: (p: SweepProgress) => Promise<void> | void,
): Promise<{ places: GooglePlace[]; requestsMade: number; capped: boolean }> {
  const { origin, radiusMi } = opts;
  const { tiles, maxRequests } = initialTiles(opts);
  const queue: Tile[] = tiles;
  const found = new Map<string, GooglePlace>();
  let tilesTotal = queue.length;
  let requestsMade = 0;
  let capped = false;

  const reachesTarget = (t: Tile) => haversineMiles(origin, t.center) < radiusMi + t.radiusMi;

  while (queue.length > 0) {
    const budget = maxRequests - requestsMade;
    if (budget <= 0) {
      capped = true;
      break;
    }
    const batch = queue.splice(0, Math.min(CONCURRENCY, budget));
    const results = await Promise.all(batch.map((t) => searchNearby(t.center, t.radiusMi)));
    requestsMade += batch.length;

    results.forEach((places, i) => {
      for (const p of places) {
        if (!p.location || p.businessStatus === "CLOSED_PERMANENTLY") continue;
        const point = { lat: p.location.latitude, lng: p.location.longitude };
        if (haversineMiles(origin, point) <= radiusMi) found.set(p.id, p);
      }
      const tile = batch[i];
      if (places.length >= NEARBY_MAX_RESULTS && tile.radiusMi / 2 >= MIN_TILE_RADIUS_MI) {
        const children = subdivideTile(tile).filter(reachesTarget);
        queue.push(...children);
        tilesTotal += children.length;
      }
    });

    await onProgress?.({ tilesTotal, requestsMade, placesFound: found.size });
  }

  return { places: [...found.values()], requestsMade, capped };
}

export async function upsertRestaurants(places: GooglePlace[]) {
  const rows = places.map(toRestaurantRow);
  for (let i = 0; i < rows.length; i += 500) {
    const { error } = await db().from("restaurants").upsert(rows.slice(i, i + 500), { onConflict: "place_id" });
    if (error) throw new Error(`Saving restaurants failed: ${error.message}`);
  }
}

/** Most recent finished sweep that already covers this origin and radius, if still fresh. */
export async function findReusableSearch(origin: LatLng, radiusMi: number) {
  const since = new Date(Date.now() - SWEEP_REUSE_DAYS * 86_400_000).toISOString();
  const { data, error } = await db()
    .from("searches")
    .select("*")
    .eq("status", "done")
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(20);
  if (error) throw new Error(error.message);
  return (data ?? []).find(
    (s) =>
      haversineMiles(origin, { lat: s.origin_lat, lng: s.origin_lng }) + radiusMi <= s.radius_mi + 0.5,
  );
}
