import { env } from "@/lib/env";

// Places photo resource names look like places/{placeId}/photos/{photoRef}.
const PHOTO_NAME = /^places\/[\w-]+\/photos\/[\w-]+$/;

/** Proxy Places photos so the Google key never reaches the browser. */
export async function GET(request: Request) {
  const name = new URL(request.url).searchParams.get("name") ?? "";
  if (!PHOTO_NAME.test(name)) return new Response("Bad photo name", { status: 400 });

  const url = new URL(`https://places.googleapis.com/v1/${name}/media`);
  url.searchParams.set("maxHeightPx", "800");
  url.searchParams.set("maxWidthPx", "800");
  url.searchParams.set("key", env("GOOGLE_MAPS_API_KEY"));

  const upstream = await fetch(url);
  if (!upstream.ok || !upstream.body) return new Response("Photo unavailable", { status: 502 });
  return new Response(upstream.body, {
    headers: {
      "Content-Type": upstream.headers.get("Content-Type") ?? "image/jpeg",
      // Each photo fetch is billed; let the browser keep it for a day.
      "Cache-Control": "private, max-age=86400",
    },
  });
}
