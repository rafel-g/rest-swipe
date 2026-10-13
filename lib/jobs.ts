import "server-only";
import { sweep, upsertRestaurants } from "./ingest";
import { db } from "./supabase";
import { tagUntagged } from "./tagging";

export type SearchRow = {
  id: number;
  label: string | null;
  origin_lat: number;
  origin_lng: number;
  radius_mi: number;
  status: "pending" | "fetching" | "tagging" | "done" | "failed";
  tiles_total: number;
  requests_made: number;
  places_found: number;
  tagged_count: number;
  error: string | null;
  created_at: string;
  finished_at: string | null;
};

async function updateSearch(id: number, patch: Partial<SearchRow>) {
  const { error } = await db().from("searches").update(patch).eq("id", id);
  if (error) throw new Error(`Updating search ${id} failed: ${error.message}`);
}

/** Fetch restaurants for a search, then tag anything untagged. Progress is written to the row. */
export async function runSearchJob(id: number, opts: { maxRequests?: number } = {}) {
  const { data: search, error } = await db().from("searches").select("*").eq("id", id).single<SearchRow>();
  if (error || !search) throw new Error(`Search ${id} not found`);

  try {
    await updateSearch(id, { status: "fetching" });
    const result = await sweep(
      {
        origin: { lat: search.origin_lat, lng: search.origin_lng },
        radiusMi: search.radius_mi,
        maxRequests: opts.maxRequests,
      },
      (p) =>
        updateSearch(id, {
          tiles_total: p.tilesTotal,
          requests_made: p.requestsMade,
          places_found: p.placesFound,
        }),
    );
    await upsertRestaurants(result.places);

    await updateSearch(id, { status: "tagging" });
    await tagUntagged((n) => updateSearch(id, { tagged_count: n }));

    await updateSearch(id, {
      status: "done",
      finished_at: new Date().toISOString(),
      error: result.capped ? "Stopped at the request cap; dense areas may be incomplete." : null,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await updateSearch(id, { status: "failed", error: message, finished_at: new Date().toISOString() });
    throw e;
  }
}

/** The search whose origin the deck is measured from: the newest one that didn't fail. */
export async function latestSearch(): Promise<SearchRow | null> {
  const { data, error } = await db()
    .from("searches")
    .select("*")
    .neq("status", "failed")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<SearchRow>();
  if (error) throw new Error(error.message);
  return data;
}
