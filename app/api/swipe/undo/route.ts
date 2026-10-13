import { undoLastSwipe } from "@/lib/deck";
import { errorResponse } from "@/lib/http";

export async function POST() {
  try {
    const placeId = await undoLastSwipe();
    return Response.json({ ok: placeId !== null, placeId });
  } catch (e) {
    return errorResponse(e);
  }
}
