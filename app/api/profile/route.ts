import { connection } from "next/server";
import { z } from "zod";
import { loadProfile, saveProfile } from "@/lib/deck";
import { errorResponse } from "@/lib/http";
import { isCuisine, isDietary } from "@/lib/taxonomy";

const Body = z.object({
  cuisines: z.array(z.string().refine(isCuisine, "Unknown cuisine")).max(40),
  dietary: z.array(z.string().refine(isDietary, "Unknown dietary restriction")).max(10),
});

/** Cuisines and dietary restrictions picked at setup. */
export async function GET() {
  await connection();
  try {
    const { cuisines, dietary } = await loadProfile();
    return Response.json({ cuisines, dietary });
  } catch (e) {
    return errorResponse(e);
  }
}

/** Save setup choices. Restarts the warmup swipes. */
export async function PUT(request: Request) {
  try {
    const body = Body.parse(await request.json());
    await saveProfile({ cuisines: [...new Set(body.cuisines)], dietary: [...new Set(body.dietary)] });
    return Response.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
