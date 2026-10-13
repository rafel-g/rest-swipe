import { z } from "zod";
import { getDeck } from "@/lib/deck";
import { errorResponse } from "@/lib/http";
import { isCuisine, isTag } from "@/lib/taxonomy";

const Query = z.object({
  cuisine: z.string().refine(isCuisine, "Unknown cuisine").optional(),
  tags: z
    .string()
    .transform((s) => s.split(",").filter(Boolean))
    .pipe(z.array(z.string().refine(isTag, "Unknown tag")))
    .optional(),
  maxPrice: z.coerce.number().int().min(0).max(4).optional(),
  maxDist: z.coerce.number().positive().max(50).optional(),
  openNow: z.stringbool().optional(),
  includePassed: z.stringbool().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(10),
});

export async function GET(request: Request) {
  try {
    const params = Object.fromEntries(new URL(request.url).searchParams);
    const q = Query.parse(params);
    const { cards, remaining } = await getDeck({
      cuisine: q.cuisine ?? null,
      tags: q.tags,
      maxPrice: q.maxPrice,
      maxDistMi: q.maxDist,
      openNow: q.openNow,
      includePassed: q.includePassed,
      limit: q.limit,
    });
    // Opening hours aren't shown on the card.
    const slim = cards.map((card) => ({ ...card, hours: undefined, utc_offset_min: undefined }));
    return Response.json({ cards: slim, remaining });
  } catch (e) {
    return errorResponse(e);
  }
}
