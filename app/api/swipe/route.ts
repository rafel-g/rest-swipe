import { z } from "zod";
import { recordSwipe } from "@/lib/deck";
import { errorResponse } from "@/lib/http";

const Body = z.object({
  placeId: z.string().min(1),
  decision: z.enum(["yes", "no"]),
  cuisineFilter: z.string().nullable().default(null),
});

export async function POST(request: Request) {
  try {
    const body = Body.parse(await request.json());
    const deltas = await recordSwipe(body.placeId, body.decision, body.cuisineFilter);
    if (!deltas) return Response.json({ error: "Restaurant not found" }, { status: 404 });
    return Response.json({ ok: true, deltas });
  } catch (e) {
    return errorResponse(e);
  }
}
