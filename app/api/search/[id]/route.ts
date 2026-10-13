import type { NextRequest } from "next/server";
import { errorResponse } from "@/lib/http";
import { db } from "@/lib/supabase";

export async function GET(_req: NextRequest, ctx: RouteContext<"/api/search/[id]">) {
  try {
    const { id } = await ctx.params;
    const { data, error } = await db().from("searches").select("*").eq("id", Number(id)).maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) return Response.json({ error: "Search not found" }, { status: 404 });
    return Response.json({ search: data });
  } catch (e) {
    return errorResponse(e);
  }
}
