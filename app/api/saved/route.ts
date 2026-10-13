import { connection } from "next/server";
import { getSaved } from "@/lib/deck";
import { errorResponse } from "@/lib/http";

export async function GET() {
  await connection(); // always read fresh from the database
  try {
    return Response.json({ saved: await getSaved() });
  } catch (e) {
    return errorResponse(e);
  }
}
