import type { OpeningPeriod } from "./places";
import { DIETARY, isDietary, label } from "./taxonomy";

/** A restaurant as the ranking engine sees it. */
export type Candidate = {
  place_id: string;
  name: string;
  rating: number | null;
  rating_count: number;
  price_level: number | null;
  cuisine: string | null;
  tags: string[];
  distance_mi: number;
  hours: OpeningPeriod[] | null;
  utc_offset_min: number | null;
};

export type Weights = Record<string, number>;
export type Decision = "yes" | "no";

export type DeckFilter = {
  tags?: string[];
  maxPrice?: number;
  maxDistMi?: number;
  openNow?: boolean;
};

export type Ranked<C extends Candidate> = C & { score: number; reasons: string[]; explore: boolean };

/** What the user picked at setup. */
export type Profile = { cuisines: string[]; dietary: string[] };

// Score = quality + distance + learned affinity. Kept in one place so they are easy to tune.
export const SCORE_WEIGHTS = { quality: 0.5, distance: 0.15, affinity: 0.35 };
/** Bayesian prior strength: a place needs about this many reviews before its own rating dominates. */
export const PRIOR_REVIEWS = 50;
export const LEARNING_RATE = 0.3;
export const WEIGHT_LIMIT = 3;
export const EXPLORE_RATE = 0.1;
const DEFAULT_MEAN_RATING = 4.2;
/** Head start for cuisines picked at setup, on the same scale as learned weights (one "yes" is LEARNING_RATE). */
export const PROFILE_CUISINE_WEIGHT = 1;
/** Score bonus for places that fit every dietary restriction: strong enough to rank them first, not a filter. */
export const DIETARY_BONUS = 0.3;
/** Swipes after setup that only show picked cuisines, before learned ranking takes over. */
export const WARMUP_SWIPES = 5;

// Price tags duplicate the price feature, so they don't count twice.
const PRICE_TAGS = new Set(["cheap-eats", "mid-range", "upscale"]);

/** Features a restaurant contributes to the preference model. */
export function featuresOf(c: Pick<Candidate, "cuisine" | "tags" | "price_level">): string[] {
  const features: string[] = [];
  if (c.cuisine) features.push(`cuisine:${c.cuisine}`);
  for (const t of c.tags) if (!PRICE_TAGS.has(t)) features.push(`tag:${t}`);
  if (c.price_level !== null) features.push(`price:${c.price_level}`);
  return features;
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Rating shrunk toward the mean for places with few reviews, mapped to 0..1 (3.0 stars -> 0, 5.0 -> 1). */
export function qualityScore(c: Pick<Candidate, "rating" | "rating_count">, meanRating: number): number {
  const bayes =
    c.rating === null
      ? meanRating - 0.3
      : (c.rating_count * c.rating + PRIOR_REVIEWS * meanRating) / (c.rating_count + PRIOR_REVIEWS);
  return clamp((bayes - 3) / 2, 0, 1);
}

/** Learned preference mapped to 0..1, where 0.5 means no opinion yet. */
export function affinityScore(c: Candidate, weights: Weights): number {
  const raw = featuresOf(c).reduce((sum, f) => sum + (weights[f] ?? 0), 0);
  return (Math.tanh(raw / 2) + 1) / 2;
}

/** Learned weights plus the setup head start. Kept separate in storage so swipes and undo stay exact. */
export function withProfile(weights: Weights, profile: Profile): Weights {
  const merged = { ...weights };
  for (const c of profile.cuisines) merged[`cuisine:${c}`] = (merged[`cuisine:${c}`] ?? 0) + PROFILE_CUISINE_WEIGHT;
  return merged;
}

/** Whether a place fits every dietary restriction, judged from its cuisine and tags. */
export function fitsDietary(c: Pick<Candidate, "cuisine" | "tags">, dietary: string[]): boolean {
  return dietary.filter(isDietary).every((d) => {
    const match = DIETARY[d];
    return (
      (c.cuisine !== null && (match.cuisines as readonly string[]).includes(c.cuisine)) ||
      match.tags.some((t) => c.tags.includes(t))
    );
  });
}

export function scoreCandidate(
  c: Candidate,
  weights: Weights,
  meanRating: number,
  maxDistMi: number,
  dietary: string[] = [],
): number {
  const distance = 1 - clamp(c.distance_mi / Math.max(maxDistMi, 0.1), 0, 1);
  return (
    SCORE_WEIGHTS.quality * qualityScore(c, meanRating) +
    SCORE_WEIGHTS.distance * distance +
    SCORE_WEIGHTS.affinity * affinityScore(c, weights) +
    (dietary.length > 0 && fitsDietary(c, dietary) ? DIETARY_BONUS : 0)
  );
}

const MINUTES_PER_WEEK = 7 * 24 * 60;

/** Whether a place is open at `now`, given Google's weekly periods in the place's local time. */
export function isOpenAt(hours: OpeningPeriod[] | null, utcOffsetMin: number | null, now: Date): boolean | null {
  if (!hours || hours.length === 0 || utcOffsetMin === null) return null;
  // Google encodes "open 24/7" as a single period opening Sunday 00:00 with no close.
  if (hours.length === 1 && !hours[0].close) return true;
  const local = new Date(now.getTime() + utcOffsetMin * 60_000);
  const t = local.getUTCDay() * 1440 + local.getUTCHours() * 60 + local.getUTCMinutes();
  return hours.some((p) => {
    if (!p.close) return false;
    const open = p.open.day * 1440 + p.open.hour * 60 + p.open.minute;
    let close = p.close.day * 1440 + p.close.hour * 60 + p.close.minute;
    if (close <= open) close += MINUTES_PER_WEEK; // wraps past Saturday night
    return (t >= open && t < close) || (t + MINUTES_PER_WEEK >= open && t + MINUTES_PER_WEEK < close);
  });
}

// Hosts many unrelated restaurants share, so they say nothing about which brand a place is.
const SHARED_HOSTS = new Set([
  "facebook.com",
  "instagram.com",
  "linktr.ee",
  "google.com",
  "sites.google.com",
  "business.site",
  "square.site",
  "toasttab.com",
  "order.toasttab.com",
  "clover.com",
  "yelp.com",
  "doordash.com",
  "ubereats.com",
  "grubhub.com",
  "wixsite.com",
  "ihg.com",
]);

/**
 * Identifies a restaurant across its locations. Locations of one brand nearly always share a
 * website, while their names vary ("Pizza Lucé Hopkins", "Pizza Lucé St Paul"). The name's first
 * word is part of the key so a restaurant group's different concepts on one site stay apart
 * ("Bloomington ChopHouse" vs "Olive Lounge"). Without a usable website, the whole name is the key.
 */
export function brandKey(r: { name: string; website: string | null }): string {
  const words = r.name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/['’]/g, "") // "Lucky's" and "Luckys" are the same word
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
  if (r.website) {
    try {
      const host = new URL(r.website).hostname.toLowerCase().replace(/^www\./, "");
      const first = words.find((w) => w !== "the") ?? "";
      if (!SHARED_HOSTS.has(host)) return `site:${host}:${first}`;
    } catch {
      // Malformed URL: use the name.
    }
  }
  return `name:${words.join(" ")}`;
}

/** One location per brand, the closest, so the deck never shows the same restaurant twice. */
export function closestPerBrand<C extends Candidate & { website: string | null }>(cands: C[]): C[] {
  const best = new Map<string, C>();
  for (const c of cands) {
    const key = brandKey(c);
    const current = best.get(key);
    if (!current || c.distance_mi < current.distance_mi) best.set(key, c);
  }
  return [...best.values()];
}

/** Hard filters applied before scoring. Places with unknown hours are dropped when openNow is set. */
export function applyFilter<C extends Candidate>(cands: C[], filter: DeckFilter, now = new Date()): C[] {
  return cands.filter((c) => {
    if (filter.tags?.length && !filter.tags.every((t) => c.tags.includes(t))) return false;
    if (filter.maxPrice !== undefined && c.price_level !== null && c.price_level > filter.maxPrice) return false;
    if (filter.maxDistMi !== undefined && c.distance_mi > filter.maxDistMi) return false;
    if (filter.openNow && isOpenAt(c.hours, c.utc_offset_min, now) !== true) return false;
    return true;
  });
}

function reasonsFor(c: Candidate, weights: Weights, dietary: string[]): string[] {
  const diet = dietary.length > 0 && fitsDietary(c, dietary) ? [`Fits ${dietary.map(label).join(", ").toLowerCase()}`] : [];
  const liked = featuresOf(c)
    .map((f) => ({ f, w: weights[f] ?? 0 }))
    .filter(({ w }) => w >= 0.5)
    .sort((a, b) => b.w - a.w)
    .slice(0, 2)
    .map(({ f }) => {
      const [kind, value] = f.split(":");
      if (kind === "price") return `You like ${"$".repeat(Math.max(1, Number(value)))} spots`;
      if (kind === "tag") return `You like ${label(value).toLowerCase()}`;
      return `You like ${label(value)}`;
    });
  return [...diet, ...liked].slice(0, 2);
}

/**
 * Score and order candidates, best first. With probability `exploreRate` per slot, a
 * well-ranked place from a cuisine you haven't swiped on yet is pulled forward so the
 * model keeps learning instead of only showing what it already knows you like.
 */
export function rankCandidates<C extends Candidate>(
  cands: C[],
  weights: Weights,
  opts: { limit: number; maxDistMi: number; exploreRate?: number; dietary?: string[]; rng?: () => number },
): Ranked<C>[] {
  const rated = cands.filter((c) => c.rating !== null);
  const meanRating = rated.length
    ? rated.reduce((s, c) => s + (c.rating as number), 0) / rated.length
    : DEFAULT_MEAN_RATING;

  const dietary = opts.dietary ?? [];
  const sorted = cands
    .map((c) => ({
      ...c,
      score: scoreCandidate(c, weights, meanRating, opts.maxDistMi, dietary),
      reasons: reasonsFor(c, weights, dietary),
      explore: false,
    }))
    .sort((a, b) => b.score - a.score || a.place_id.localeCompare(b.place_id));

  const exploreRate = opts.exploreRate ?? EXPLORE_RATE;
  const rng = opts.rng ?? Math.random;
  const isUnexplored = (c: Candidate) => c.cuisine !== null && !weights[`cuisine:${c.cuisine}`];

  const limit = Math.min(opts.limit, sorted.length);
  for (let i = 0; i < limit; i++) {
    if (exploreRate <= 0 || rng() >= exploreRate || isUnexplored(sorted[i])) continue;
    const j = sorted.findIndex((c, idx) => idx > i && isUnexplored(c));
    if (j === -1) continue;
    const [pick] = sorted.splice(j, 1);
    sorted.splice(i, 0, { ...pick, explore: true, reasons: ["Something new to try"] });
  }
  return sorted.slice(0, limit);
}

/**
 * Online update after a swipe: every feature of the restaurant moves toward the decision.
 * When you're browsing one cuisine, a "no" says nothing about that cuisine, so it is skipped.
 * Returns the deltas actually applied (after clamping) so a swipe can be undone exactly.
 */
export function updateWeights(
  weights: Weights,
  c: Pick<Candidate, "cuisine" | "tags" | "price_level">,
  decision: Decision,
  cuisineFilter: string | null,
): { next: Weights; deltas: Weights } {
  const next = { ...weights };
  const deltas: Weights = {};
  const step = decision === "yes" ? LEARNING_RATE : -LEARNING_RATE;
  for (const f of featuresOf(c)) {
    if (decision === "no" && cuisineFilter && f === `cuisine:${cuisineFilter}`) continue;
    const before = next[f] ?? 0;
    const after = clamp(before + step, -WEIGHT_LIMIT, WEIGHT_LIMIT);
    if (after === before) continue;
    next[f] = after;
    deltas[f] = after - before;
  }
  return { next, deltas };
}
