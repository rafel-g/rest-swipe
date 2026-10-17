/**
 * Single source of truth for categories. The tagger may only output these values,
 * and the UI filters and ranking features are built from the same lists.
 */

export const CUISINES = [
  "american",
  "bbq",
  "burgers",
  "pizza",
  "italian",
  "mexican",
  "latin-american",
  "chinese",
  "japanese",
  "sushi",
  "ramen",
  "korean",
  "thai",
  "vietnamese",
  "indian",
  "mediterranean",
  "middle-eastern",
  "greek",
  "french",
  "spanish",
  "african",
  "caribbean",
  "seafood",
  "steakhouse",
  "vegetarian",
  "breakfast-brunch",
  "cafe-bakery",
  "dessert",
  "sandwiches",
  "fast-food",
  "other",
] as const;

export const TAGS = [
  "cheap-eats",
  "mid-range",
  "upscale",
  "date-night",
  "family-friendly",
  "group-friendly",
  "casual",
  "outdoor-seating",
  "quick-bite",
  "takeout-friendly",
  "vegetarian-friendly",
  "vegan-options",
  "gluten-free-options",
  "spicy",
  "healthy",
  "late-night",
  "brunch",
  "bar-scene",
  "cocktails",
  "wine",
  "local-favorite",
  "hidden-gem",
  "chain",
] as const;

/** Dietary restrictions offered at setup, and the cuisine or tags that count as a match. */
export const DIETARY = {
  vegetarian: { cuisines: ["vegetarian"], tags: ["vegetarian-friendly", "vegan-options"] },
  vegan: { cuisines: ["vegetarian"], tags: ["vegan-options"] },
  "gluten-free": { cuisines: [], tags: ["gluten-free-options"] },
} as const satisfies Record<string, { cuisines: readonly Cuisine[]; tags: readonly Tag[] }>;

export type Cuisine = (typeof CUISINES)[number];
export type Tag = (typeof TAGS)[number];
export type Dietary = keyof typeof DIETARY;

export const isCuisine = (v: unknown): v is Cuisine => CUISINES.includes(v as Cuisine);
export const isTag = (v: unknown): v is Tag => TAGS.includes(v as Tag);
export const isDietary = (v: unknown): v is Dietary => typeof v === "string" && Object.hasOwn(DIETARY, v);

/** Google Places primary/secondary types that pin down a cuisine without an LLM. */
export const GOOGLE_TYPE_TO_CUISINE: Record<string, Cuisine> = {
  american_restaurant: "american",
  barbecue_restaurant: "bbq",
  hamburger_restaurant: "burgers",
  pizza_restaurant: "pizza",
  italian_restaurant: "italian",
  mexican_restaurant: "mexican",
  brazilian_restaurant: "latin-american",
  chinese_restaurant: "chinese",
  japanese_restaurant: "japanese",
  sushi_restaurant: "sushi",
  ramen_restaurant: "ramen",
  korean_restaurant: "korean",
  thai_restaurant: "thai",
  vietnamese_restaurant: "vietnamese",
  indian_restaurant: "indian",
  mediterranean_restaurant: "mediterranean",
  middle_eastern_restaurant: "middle-eastern",
  lebanese_restaurant: "middle-eastern",
  turkish_restaurant: "middle-eastern",
  greek_restaurant: "greek",
  french_restaurant: "french",
  spanish_restaurant: "spanish",
  african_restaurant: "african",
  seafood_restaurant: "seafood",
  steak_house: "steakhouse",
  vegetarian_restaurant: "vegetarian",
  vegan_restaurant: "vegetarian",
  breakfast_restaurant: "breakfast-brunch",
  brunch_restaurant: "breakfast-brunch",
  cafe: "cafe-bakery",
  coffee_shop: "cafe-bakery",
  bakery: "cafe-bakery",
  dessert_restaurant: "dessert",
  ice_cream_shop: "dessert",
  sandwich_shop: "sandwiches",
  fast_food_restaurant: "fast-food",
};

/** Cuisine implied by Google types, checking the primary type first. */
export function cuisineFromGoogleTypes(primaryType: string | null, types: string[]): Cuisine | null {
  if (primaryType && GOOGLE_TYPE_TO_CUISINE[primaryType]) return GOOGLE_TYPE_TO_CUISINE[primaryType];
  for (const t of types) if (GOOGLE_TYPE_TO_CUISINE[t]) return GOOGLE_TYPE_TO_CUISINE[t];
  return null;
}

/** Price tag derived from Google's price level, so the model doesn't have to guess it. */
export function priceTag(priceLevel: number | null): Tag | null {
  if (priceLevel === null) return null;
  if (priceLevel <= 1) return "cheap-eats";
  if (priceLevel === 2) return "mid-range";
  return "upscale";
}

export const label = (slug: string) =>
  slug
    .split("-")
    .map((w) => (w === "bbq" ? "BBQ" : w[0].toUpperCase() + w.slice(1)))
    .join(" ");
