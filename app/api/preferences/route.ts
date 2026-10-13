import { loadWeights, resetPreferences } from "@/lib/deck";
import { errorResponse } from "@/lib/http";
import { connection } from "next/server";

export async function GET() {
  await connection();
  try {
    return Response.json({ weights: await loadWeights() });
  } catch (e) {
    return errorResponse(e);
  }
}

/** Forget learned preferences (swipe history is kept). */
export async function DELETE() {
  try {
    await resetPreferences();
    return Response.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
