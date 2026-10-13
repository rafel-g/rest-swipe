/**
 * Sweep restaurants around a location from the command line.
 *   npm run ingest -- --address "Austin, TX" --dry-run
 *   npm run ingest -- --address "Austin, TX" --radius 25 --max-requests 300
 */
import { parseArgs } from "node:util";
import { DEFAULT_MAX_REQUESTS, estimateSweep } from "../lib/ingest";
import { runSearchJob } from "../lib/jobs";
import { geocode } from "../lib/places";
import { db } from "../lib/supabase";

const { values } = parseArgs({
  options: {
    address: { type: "string" },
    lat: { type: "string" },
    lng: { type: "string" },
    radius: { type: "string", default: "25" },
    "max-requests": { type: "string", default: String(DEFAULT_MAX_REQUESTS) },
    "dry-run": { type: "boolean", default: false },
  },
});

async function main() {
  const radiusMi = Number(values.radius);
  const maxRequests = Number(values["max-requests"]);
  const origin =
    values.lat && values.lng
      ? { lat: Number(values.lat), lng: Number(values.lng), formatted: `${values.lat},${values.lng}` }
      : values.address
        ? await geocode(values.address)
        : null;
  if (!origin) throw new Error('Pass --address "..." or --lat and --lng');

  const est = estimateSweep({ origin, radiusMi, maxRequests });
  console.log(`Location: ${origin.formatted} (${origin.lat.toFixed(4)}, ${origin.lng.toFixed(4)})`);
  console.log(
    `Radius: ${radiusMi} mi -> ${est.initialTiles} tiles of ${est.tileRadiusMi} mi, cap ${est.maxRequests} requests`,
  );
  console.log(`Estimated Google cost: $${est.minCostUsd.toFixed(2)} - $${est.maxCostUsd.toFixed(2)}`);
  if (values["dry-run"]) return;

  const { data, error } = await db()
    .from("searches")
    .insert({ label: origin.formatted, origin_lat: origin.lat, origin_lng: origin.lng, radius_mi: radiusMi })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  const started = Date.now();
  const timer = setInterval(async () => {
    const { data: s } = await db().from("searches").select("*").eq("id", data.id).single();
    if (s) console.log(`[${s.status}] requests ${s.requests_made}, places ${s.places_found}, tagged ${s.tagged_count}`);
  }, 3000);
  try {
    await runSearchJob(data.id, { maxRequests });
  } finally {
    clearInterval(timer);
  }
  const { data: s } = await db().from("searches").select("*").eq("id", data.id).single();
  console.log(`Done in ${Math.round((Date.now() - started) / 1000)}s: ${s.places_found} restaurants, ${s.requests_made} requests, ${s.tagged_count} tagged.`);
  if (s.error) console.log(`Note: ${s.error}`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
