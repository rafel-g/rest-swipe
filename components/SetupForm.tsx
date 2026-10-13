"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api } from "@/lib/client";

type Search = {
  id: number;
  label: string | null;
  radius_mi: number;
  status: "pending" | "fetching" | "tagging" | "done" | "failed";
  requests_made: number;
  places_found: number;
  tagged_count: number;
  error: string | null;
};

type StartResponse = {
  searchId: number;
  reused: boolean;
  label: string;
  estimate?: { initialTiles: number; minCostUsd: number; maxCostUsd: number };
};

const STATUS_TEXT: Record<Search["status"], string> = {
  pending: "Starting…",
  fetching: "Finding restaurants on Google Maps…",
  tagging: "Categorizing restaurants…",
  done: "Ready!",
  failed: "Something went wrong",
};

export function SetupForm() {
  const router = useRouter();
  const [address, setAddress] = useState("");
  const [radius, setRadius] = useState(25);
  const [force, setForce] = useState(false);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [current, setCurrent] = useState<Search | null>(null);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    api<{ search: Search | null }>("/api/search")
      .then(({ search }) => {
        setCurrent(search);
        if (search && (search.status === "fetching" || search.status === "tagging" || search.status === "pending")) {
          setActiveId(search.id);
        }
      })
      .catch((e) => setError(e.message));
  }, []);

  // Poll the running sweep.
  useEffect(() => {
    if (activeId === null) return;
    const timer = setInterval(async () => {
      try {
        const { search } = await api<{ search: Search }>(`/api/search/${activeId}`);
        setCurrent(search);
        if (search.status === "done" || search.status === "failed") {
          setActiveId(null);
          if (search.status === "failed") setError(search.error);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    }, 1500);
    return () => clearInterval(timer);
  }, [activeId]);

  function useMyLocation() {
    if (!navigator.geolocation) return setError("Your browser can't share location.");
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setAddress("");
        setLocating(false);
      },
      (err) => {
        setError(`Couldn't get your location: ${err.message}`);
        setLocating(false);
      },
      { enableHighAccuracy: false, timeout: 15000 },
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const body = coords && !address ? { ...coords, radiusMi: radius, force } : { address, radiusMi: radius, force };
      const res = await api<StartResponse>("/api/search", { method: "POST", body: JSON.stringify(body) });
      if (res.reused) {
        router.push("/swipe");
        return;
      }
      setActiveId(res.searchId);
      setCurrent({
        id: res.searchId,
        label: res.label,
        radius_mi: radius,
        status: "pending",
        requests_made: 0,
        places_found: 0,
        tagged_count: 0,
        error: null,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSubmitting(false);
    }
  }

  const running = activeId !== null;
  const canSubmit = !running && !submitting && (address.trim().length >= 3 || coords !== null);

  return (
    <div className="space-y-6 px-4">
      <form onSubmit={submit} className="space-y-4 rounded-3xl bg-white p-5 shadow-sm ring-1 ring-zinc-200 dark:bg-zinc-900 dark:ring-zinc-800">
        <div>
          <label htmlFor="address" className="mb-1.5 block text-sm font-semibold">
            Where are you?
          </label>
          <input
            id="address"
            value={address}
            onChange={(e) => {
              setAddress(e.target.value);
              if (e.target.value) setCoords(null);
            }}
            placeholder={coords ? "Using your current location" : "Address, city, or ZIP"}
            className="w-full rounded-xl border border-zinc-300 bg-transparent px-3.5 py-2.5 outline-none focus:border-zinc-900 dark:border-zinc-700 dark:focus:border-white"
          />
          <button
            type="button"
            onClick={useMyLocation}
            disabled={locating}
            className="mt-2 text-sm font-medium text-sky-600 hover:underline disabled:opacity-50 dark:text-sky-400"
          >
            {locating ? "Locating…" : coords ? "✓ Using my location" : "📍 Use my location"}
          </button>
        </div>

        <div>
          <label htmlFor="radius" className="mb-1.5 flex justify-between text-sm font-semibold">
            <span>Search radius</span>
            <span>{radius} mi</span>
          </label>
          <input
            id="radius"
            type="range"
            min={5}
            max={31}
            value={radius}
            onChange={(e) => setRadius(Number(e.target.value))}
            className="w-full accent-zinc-900 dark:accent-white"
          />
        </div>

        <label className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400">
          <input type="checkbox" checked={force} onChange={(e) => setForce(e.target.checked)} />
          Re-fetch from Google even if this area was searched recently
        </label>

        <button
          type="submit"
          disabled={!canSubmit}
          className="w-full rounded-full bg-zinc-900 py-3 font-semibold text-white transition disabled:opacity-40 dark:bg-white dark:text-zinc-900"
        >
          {submitting ? "Starting…" : "Find restaurants"}
        </button>
        <p className="text-xs text-zinc-500">
          A search makes at most 60 Google Places calls (about $2). Searching inside an area covered in the last 30 days is free.
        </p>
      </form>

      {error && <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:bg-rose-950 dark:text-rose-200">{error}</p>}

      {current && (
        <section className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-zinc-200 dark:bg-zinc-900 dark:ring-zinc-800">
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">{running ? "In progress" : "Current area"}</p>
          <p className="mt-1 font-semibold">{current.label ?? "Saved location"} · {current.radius_mi} mi</p>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{STATUS_TEXT[current.status]}</p>
          <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
            {[
              ["Restaurants", current.places_found],
              ["Categorized", current.tagged_count],
              ["API calls", current.requests_made],
            ].map(([k, v]) => (
              <div key={k} className="rounded-xl bg-zinc-50 py-2 dark:bg-zinc-800">
                <dd className="text-lg font-bold tabular-nums">{Number(v).toLocaleString()}</dd>
                <dt className="text-xs text-zinc-500">{k}</dt>
              </div>
            ))}
          </dl>
          {running && (
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
              <div className="h-full w-1/3 animate-pulse rounded-full bg-zinc-900 dark:bg-white" />
            </div>
          )}
          {current.status === "done" && (
            <>
              {current.error && <p className="mt-3 text-xs text-amber-600">{current.error}</p>}
              <Link
                href="/swipe"
                className="mt-4 block rounded-full bg-emerald-600 py-3 text-center font-semibold text-white"
              >
                Start swiping →
              </Link>
            </>
          )}
        </section>
      )}
    </div>
  );
}
