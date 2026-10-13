import "server-only";
import { unstable_rethrow } from "next/navigation";
import { z } from "zod";
import { NoSearchError } from "./deck";

/** Turn thrown errors into JSON responses without leaking stack traces. */
export function errorResponse(e: unknown) {
  // Let Next.js's own control-flow errors (e.g. prerender bailouts) through.
  unstable_rethrow(e);
  if (e instanceof z.ZodError) {
    return Response.json({ error: "Invalid request", issues: z.treeifyError(e) }, { status: 400 });
  }
  if (e instanceof NoSearchError) return Response.json({ error: e.message, code: "no_search" }, { status: 409 });
  const message = e instanceof Error ? e.message : "Unexpected error";
  console.error("[api]", e);
  return Response.json({ error: message }, { status: 500 });
}
