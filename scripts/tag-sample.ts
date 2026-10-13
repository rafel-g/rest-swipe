/** Smoke-test the tagger on made-up restaurants without touching the database: npm run tag:sample */
import { classifyBatch, type TagInput } from "../lib/tagging";

const sample: TagInput[] = [
  {
    place_id: "sample-1",
    name: "Bangkok Garden",
    primary_type: "thai_restaurant",
    google_types: ["thai_restaurant", "restaurant", "food"],
    summary: "Cozy spot for spicy curries, noodles and Thai iced tea.",
    price_level: 1,
    rating: 4.6,
    rating_count: 1240,
  },
  {
    place_id: "sample-2",
    name: "Lucia's Trattoria & Wine Bar",
    primary_type: "restaurant",
    google_types: ["restaurant", "bar", "food"],
    summary: "Candlelit trattoria with handmade pasta and a long Italian wine list.",
    price_level: 3,
    rating: 4.8,
    rating_count: 85,
  },
  {
    place_id: "sample-3",
    name: "Taco Bell",
    primary_type: "fast_food_restaurant",
    google_types: ["fast_food_restaurant", "mexican_restaurant", "restaurant"],
    summary: null,
    price_level: 1,
    rating: 3.7,
    rating_count: 900,
  },
];

classifyBatch(sample)
  .then((results) => {
    for (const r of results) console.log(r.place_id, "->", r.cuisine, r.tags.join(", "));
    if (results.length !== sample.length) {
      console.error(`Expected ${sample.length} results, got ${results.length}`);
      process.exit(1);
    }
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
