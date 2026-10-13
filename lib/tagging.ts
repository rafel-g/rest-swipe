import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { db } from "./supabase";
import { CUISINES, TAGS, cuisineFromGoogleTypes, priceTag, type Cuisine, type Tag } from "./taxonomy";

export const TAGGING_MODEL = "claude-haiku-5-5";
const BATCH_SIZE = 20;
const CONCURRENT_BATCHES = 4;
const MAX_TAGS = 6;

export type TagInput = {
  place_id: string;
  name: string;
  primary_type: string | null;
  google_types: string[];
  summary: string | null;
  price_level: number | null;
  rating: number | null;
  rating_count: number;
};

export type TagResult = { place_id: string; cuisine: Cuisine; tags: Tag[] };

const OutputSchema = z.object({
  results: z.array(
    z.object({
      place_id: z.string(),
      cuisine: z.enum(CUISINES),
      tags: z.array(z.enum(TAGS)),
    }),
  ),
});

const SYSTEM_PROMPT = `You categorize restaurants for a personal restaurant-recommendation app.

For each restaurant, choose:
- cuisine: exactly one value from the allowed cuisine list. Prefer the most specific fit (e.g. "sushi" over "japanese" for a sushi bar, "pizza" over "italian" for a pizzeria). Counter-service fast food chains are "fast-food" even when they serve a specific cuisine. Use "other" only when nothing fits.
- tags: up to ${MAX_TAGS} values from the allowed tag list that a diner would find useful when choosing where to eat.

Base your answer on the name, Google place types, editorial summary, price level, and rating. Google's cuisine hint is usually right; override it only when the name or summary clearly says otherwise. Only use a tag when the evidence supports it - for example "chain" for recognizable national chains, "hidden-gem" for highly rated places with few reviews, "local-favorite" for highly rated places with many reviews. Leave tags out rather than guessing.

Return one result per input restaurant, using its exact place_id.`;

const PRICE_LABELS = ["free", "inexpensive", "moderate", "expensive", "very expensive"];

function describe(r: TagInput) {
  return {
    place_id: r.place_id,
    name: r.name,
    google_cuisine_hint: cuisineFromGoogleTypes(r.primary_type, r.google_types),
    google_types: r.google_types.filter((t) => !["point_of_interest", "establishment", "food"].includes(t)),
    summary: r.summary,
    price: r.price_level === null ? "unknown" : PRICE_LABELS[r.price_level],
    rating: r.rating === null ? "unrated" : `${r.rating} from ${r.rating_count} reviews`,
  };
}

let client: Anthropic | undefined;

/**
 * Classify one batch. Returns results for the restaurants the model answered, merged with
 * deterministic tags. Missing or unknown place_ids are dropped (they stay untagged for a retry).
 */
export async function classifyBatch(batch: TagInput[]): Promise<TagResult[]> {
  client ??= new Anthropic();
  const byId = new Map(batch.map((r) => [r.place_id, r]));

  for (let attempt = 0; attempt < 2; attempt++) {
    const response = await client.messages.parse({
      model: TAGGING_MODEL,
      max_tokens: 8000,
      output_config: { effort: "low", format: zodOutputFormat(OutputSchema) },
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: `Allowed cuisines: ${CUISINES.join(", ")}\nAllowed tags: ${TAGS.join(", ")}\n\nRestaurants:\n${JSON.stringify(batch.map(describe), null, 1)}`,
        },
      ],
    });

    if (response.stop_reason === "refusal" || !response.parsed_output) continue;

    const results: TagResult[] = [];
    for (const r of response.parsed_output.results) {
      const input = byId.get(r.place_id);
      if (!input) continue;
      const derived = priceTag(input.price_level);
      // Price comes from Google's data, not the model's guess.
      const modelTags = r.tags.filter((t) => !["cheap-eats", "mid-range", "upscale"].includes(t));
      const tags = [...new Set([...(derived ? [derived] : []), ...modelTags])].slice(0, MAX_TAGS);
      results.push({ place_id: r.place_id, cuisine: r.cuisine, tags });
    }
    return results;
  }
  return [];
}

/** Fallback when the model can't classify a row: Google's type, price tag, nothing else. */
function fallbackTags(r: TagInput): TagResult {
  const price = priceTag(r.price_level);
  return {
    place_id: r.place_id,
    cuisine: cuisineFromGoogleTypes(r.primary_type, r.google_types) ?? "other",
    tags: price ? [price] : [],
  };
}

async function saveTags(results: TagResult[]) {
  const taggedAt = new Date().toISOString();
  await Promise.all(
    results.map(async (r) => {
      const { error } = await db()
        .from("restaurants")
        .update({ cuisine: r.cuisine, tags: r.tags, tagged_at: taggedAt })
        .eq("place_id", r.place_id);
      if (error) throw new Error(`Saving tags failed: ${error.message}`);
    }),
  );
}

/**
 * Tag every untagged restaurant. Rows the model skips twice get Google-only fallback tags
 * so a bad row can't block the run forever.
 */
export async function tagUntagged(onProgress?: (taggedSoFar: number) => Promise<void> | void) {
  let tagged = 0;
  const failedOnce = new Set<string>();

  for (;;) {
    const { data, error } = await db()
      .from("restaurants")
      .select("place_id,name,primary_type,google_types,summary,price_level,rating,rating_count")
      .is("tagged_at", null)
      .limit(BATCH_SIZE * CONCURRENT_BATCHES);
    if (error) throw new Error(error.message);
    const rows = (data ?? []) as TagInput[];
    if (rows.length === 0) break;

    const batches: TagInput[][] = [];
    for (let i = 0; i < rows.length; i += BATCH_SIZE) batches.push(rows.slice(i, i + BATCH_SIZE));

    const answered = (await Promise.all(batches.map(classifyBatch))).flat();
    const answeredIds = new Set(answered.map((r) => r.place_id));
    const fallbacks: TagResult[] = [];
    for (const row of rows) {
      if (answeredIds.has(row.place_id)) continue;
      if (failedOnce.has(row.place_id)) fallbacks.push(fallbackTags(row));
      else failedOnce.add(row.place_id);
    }

    await saveTags([...answered, ...fallbacks]);
    tagged += answered.length + fallbacks.length;
    await onProgress?.(tagged);
  }
  return tagged;
}
