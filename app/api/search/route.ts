import { after, connection } from "next/server";
import { z } from "zod";
import { errorResponse } from "@/lib/http";
import { DEFAULT_MAX_REQUESTS, estimateSweep, findReusableSearch } from "@/lib/ingest";
import { latestSearch, runSearchJob } from "@/lib/jobs";
import { geocode } from "@/lib/places";
import { db } from "@/lib/supabase";

const Body = z
  .object({
    address: z.string().trim().min(3).optional(),
    lat: z.number().min(-90).max(90).optional(),
    lng: z.number().min(-180).max(180).optional(),
    radiusMi: z.number().min(1).max(31).default(25), // Places caps a circle at 50 km (~31 mi)
    maxRequests: z.number().int().min(1).max(2000).default(DEFAULT_MAX_REQUESTS),
    force: z.boolean().default(false),
  })
  .refine((b) => b.address || (b.lat !== undefined && b.lng !== undefined), {
    message: "Provide an address or lat/lng",
  });

/** Latest search (for the setup screen to show what data exists). */
export async function GET() {
  await connection();
  try {
    return Response.json({ search: await latestSearch() });
  } catch (e) {
    return errorResponse(e);
  }
}

/** Start a sweep in the background. Reuses a recent sweep that already covers the area unless forced. */
export async function POST(request: Request) {
  try {
    const body = Body.parse(await request.json());
    const origin =
      body.lat !== undefined && body.lng !== undefined
        ? { lat: body.lat, lng: body.lng, formatted: "Current location" }
        : await geocode(body.address!);

    if (!body.force) {
      const reusable = await findReusableSearch(origin, body.radiusMi);
      if (reusable) {
        // Point the deck at this origin without calling Google again.
        const { data, error } = await db()
          .from("searches")
          .insert({
            label: origin.formatted,
            origin_lat: origin.lat,
            origin_lng: origin.lng,
            radius_mi: body.radiusMi,
            status: "done",
            places_found: reusable.places_found,
            finished_at: new Date().toISOString(),
          })
          .select("id")
          .single();
        if (error) throw new Error(error.message);
        return Response.json({ searchId: data.id, reused: true, label: origin.formatted });
      }
    }

    const estimate = estimateSweep({ origin, radiusMi: body.radiusMi, maxRequests: body.maxRequests });
    const { data, error } = await db()
      .from("searches")
      .insert({
        label: origin.formatted,
        origin_lat: origin.lat,
        origin_lng: origin.lng,
        radius_mi: body.radiusMi,
        tiles_total: estimate.initialTiles,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    after(() =>
      runSearchJob(data.id, { maxRequests: body.maxRequests }).catch((e) =>
        console.error(`[search ${data.id}] failed`, e),
      ),
    );
    return Response.json({ searchId: data.id, reused: false, label: origin.formatted, estimate }, { status: 202 });
  } catch (e) {
    return errorResponse(e);
  }
}
