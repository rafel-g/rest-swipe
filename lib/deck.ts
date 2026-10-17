import "server-only";
import { metersToMiles, milesToMeters } from "./geo";
import { latestSearch } from "./jobs";
import {
  applyFilter,
  EXPLORE_RATE,
  rankCandidates,
  updateWeights,
  WARMUP_SWIPES,
  withProfile,
  type Candidate,
  type Decision,
  type DeckFilter,
  type Profile,
  type Weights,
} from "./ranking";
import { db } from "./supabase";

/** Everything the swipe card shows. */
export type DeckRow = Candidate & {
  address: string | null;
  summary: string | null;
  photo_name: string | null;
  website: string | null;
  maps_url: string | null;
  lat: number;
  lng: number;
};

export class NoSearchError extends Error {
  constructor() {
    super("No restaurants yet. Set a location and fetch restaurants first.");
  }
}

const PAGE = 1000; // PostgREST returns at most 1000 rows per request

/** The app is for local spots: anything the tagger marked as a chain never reaches the deck. */
const HIDDEN_TAG = "chain";

/** All unswiped, non-chain restaurants around the active search origin, with distance in miles. */
export async function loadCandidates(opts: { cuisine?: string | null; includePassed?: boolean } = {}) {
  const search = await latestSearch();
  if (!search) throw new NoSearchError();
  const rows: DeckRow[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await db()
      .rpc("deck_candidates", {
        p_lat: search.origin_lat,
        p_lng: search.origin_lng,
        p_radius_m: milesToMeters(search.radius_mi),
        p_cuisine: opts.cuisine ?? null,
        p_include_passed: opts.includePassed ?? false,
      })
      .range(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    for (const r of data ?? []) {
      const tags: string[] = r.tags ?? [];
      if (tags.includes(HIDDEN_TAG)) continue;
      rows.push({ ...r, tags, distance_mi: metersToMiles(r.distance_m) });
    }
    if (!data || data.length < PAGE) break;
  }
  return { search, rows };
}

export async function loadWeights(): Promise<Weights> {
  const { data, error } = await db().from("preference_weights").select("feature,weight");
  if (error) throw new Error(error.message);
  return Object.fromEntries((data ?? []).map((r) => [r.feature, r.weight]));
}

export async function loadProfile(): Promise<Profile & { updated_at: string | null }> {
  const { data, error } = await db().from("user_profile").select("cuisines,dietary,updated_at").maybeSingle();
  if (error) throw new Error(error.message);
  return data ?? { cuisines: [], dietary: [], updated_at: null };
}

export async function saveProfile(profile: Profile) {
  const { error } = await db()
    .from("user_profile")
    .upsert({ id: true, ...profile, updated_at: new Date().toISOString() }, { onConflict: "id" });
  if (error) throw new Error(error.message);
}

async function swipesSince(since: string | null) {
  let query = db().from("swipes").select("id", { count: "exact", head: true });
  if (since) query = query.gte("created_at", since);
  const { count, error } = await query;
  if (error) throw new Error(error.message);
  return count ?? 0;
}

export async function getDeck(
  params: DeckFilter & { cuisine?: string | null; includePassed?: boolean; limit?: number },
) {
  const [{ search, rows }, weights, profile] = await Promise.all([
    loadCandidates({ cuisine: params.cuisine, includePassed: params.includePassed }),
    loadWeights(),
    loadProfile(),
  ]);
  const filtered = applyFilter(rows, params);

  const limit = params.limit ?? 10;
  // Warmup: the first few swipes after setup put the cuisines you picked first,
  // ranked by rating, distance, and diet, before learned preferences take over.
  const warmup =
    !params.cuisine && profile.cuisines.length > 0 && (await swipesSince(profile.updated_at)) < WARMUP_SWIPES;

  const ranked = rankCandidates(filtered, withProfile(weights, profile), {
    limit: warmup ? filtered.length : limit,
    maxDistMi: params.maxDistMi ?? search.radius_mi,
    // Exploring other cuisines makes no sense when you asked for one, or while warming up.
    exploreRate: params.cuisine || warmup ? 0 : EXPLORE_RATE,
    dietary: profile.dietary,
  });
  // Picked cuisines first, then everything else, so a thin pick never empties the deck.
  const isPicked = (c: Candidate) => c.cuisine !== null && profile.cuisines.includes(c.cuisine);
  const cards = warmup ? [...ranked.filter(isPicked), ...ranked.filter((c) => !isPicked(c))].slice(0, limit) : ranked;
  return { cards, remaining: filtered.length, search };
}

async function addToWeights(deltas: Weights, sign: 1 | -1) {
  const features = Object.keys(deltas);
  if (features.length === 0) return;
  const current = await loadWeights();
  const now = new Date().toISOString();
  const rows = features.map((feature) => ({
    feature,
    weight: (current[feature] ?? 0) + sign * deltas[feature],
    updated_at: now,
  }));
  const { error } = await db().from("preference_weights").upsert(rows, { onConflict: "feature" });
  if (error) throw new Error(error.message);
}

export async function recordSwipe(placeId: string, decision: Decision, cuisineFilter: string | null) {
  const { data: place, error } = await db()
    .from("restaurants")
    .select("cuisine,tags,price_level")
    .eq("place_id", placeId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!place) return null;

  const { deltas } = updateWeights(await loadWeights(), place, decision, cuisineFilter);
  await addToWeights(deltas, 1);
  const { error: insertError } = await db()
    .from("swipes")
    .insert({ place_id: placeId, decision, cuisine_filter: cuisineFilter, weight_deltas: deltas });
  if (insertError) throw new Error(insertError.message);
  return deltas;
}

/** Remove the latest swipe and reverse exactly the weight change it made. */
export async function undoLastSwipe() {
  const { data: last, error } = await db()
    .from("swipes")
    .select("id,place_id,weight_deltas")
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!last) return null;
  await addToWeights(last.weight_deltas as Weights, -1);
  const { error: deleteError } = await db().from("swipes").delete().eq("id", last.id);
  if (deleteError) throw new Error(deleteError.message);
  return last.place_id as string;
}

export type SavedRestaurant = Pick<
  DeckRow,
  "place_id" | "name" | "address" | "rating" | "rating_count" | "price_level" | "cuisine" | "tags" | "photo_name" | "website" | "maps_url"
>;

export async function getSaved() {
  const { data, error } = await db()
    .from("swipes")
    .select("created_at, restaurants(place_id,name,address,rating,rating_count,price_level,cuisine,tags,photo_name,website,maps_url)")
    .eq("decision", "yes")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  // A place swiped "yes" twice (via "show passed again") should appear once.
  const seen = new Set<string>();
  return (data ?? [])
    .map((s) => ({ saved_at: s.created_at as string, ...(s.restaurants as unknown as SavedRestaurant) }))
    .filter((r) => {
      if (!r.place_id || seen.has(r.place_id)) return false;
      seen.add(r.place_id);
      return true;
    });
}

export async function resetPreferences() {
  const { error } = await db().from("preference_weights").delete().neq("feature", "");
  if (error) throw new Error(error.message);
}
