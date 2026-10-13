import { connection } from "next/server";
import { loadCandidates } from "@/lib/deck";
import { errorResponse } from "@/lib/http";
import { label } from "@/lib/taxonomy";

/** Cuisines and tags present among unswiped restaurants, with counts, for the filter chips. */
export async function GET() {
  await connection();
  try {
    const { rows, search } = await loadCandidates();
    const cuisines = new Map<string, number>();
    const tags = new Map<string, number>();
    for (const r of rows) {
      if (r.cuisine) cuisines.set(r.cuisine, (cuisines.get(r.cuisine) ?? 0) + 1);
      for (const t of r.tags) tags.set(t, (tags.get(t) ?? 0) + 1);
    }
    const toList = (m: Map<string, number>) =>
      [...m.entries()].sort((a, b) => b[1] - a[1]).map(([value, count]) => ({ value, label: label(value), count }));
    return Response.json({
      cuisines: toList(cuisines),
      tags: toList(tags),
      total: rows.length,
      untagged: rows.filter((r) => !r.cuisine).length,
      location: search.label,
      radiusMi: search.radius_mi,
    });
  } catch (e) {
    return errorResponse(e);
  }
}
