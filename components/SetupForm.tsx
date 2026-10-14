"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api } from "@/lib/client";
import { PinIcon } from "./icons";

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
      <form onSubmit={submit} className="space-y-4 rounded-[28px] bg-card p-5">
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
            className="w-full rounded-2xl border-2 border-line bg-soft px-4 py-3 outline-none placeholder:text-muted focus:border-ink"
          />
          <button
            type="button"
            onClick={useMyLocation}
            disabled={locating}
            className="mt-2 flex min-h-9 items-center gap-1.5 text-sm font-semibold hover:underline disabled:opacity-50"
          >
            <PinIcon className="h-4 w-4" />
            {locating ? "Locating…" : coords ? "Using my location" : "Use my location"}
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
            className="w-full accent-[var(--ink)]"
          />
        </div>

        <label className="flex items-center gap-2 text-sm text-muted">
          <input type="checkbox" checked={force} onChange={(e) => setForce(e.target.checked)} />
          Re-fetch from Google even if this area was searched recently
        </label>

        <button
          type="submit"
          disabled={!canSubmit}
          className="w-full rounded-full border-[3px] border-on-coral bg-coral py-3 text-lg font-bold text-on-coral transition active:scale-[0.98] disabled:opacity-40"
        >
          {submitting ? "Starting…" : "Find restaurants"}
        </button>
        <p className="text-xs text-muted">
          A search makes at most 60 Google Places calls (about $2). Searching inside an area covered in the last 30 days is free.
        </p>
      </form>

      {error && <p className="rounded-2xl bg-peach px-4 py-3 text-sm font-medium text-danger">{error}</p>}

      {current && (
        <section className="rounded-[28px] bg-card p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">{running ? "In progress" : "Current area"}</p>
          <p className="mt-1 font-semibold">{current.label ?? "Saved location"} · {current.radius_mi} mi</p>
          <p className="mt-1 text-sm text-muted">{STATUS_TEXT[current.status]}</p>
          <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
            {[
              ["Restaurants", current.places_found],
              ["Categorized", current.tagged_count],
              ["API calls", current.requests_made],
            ].map(([k, v]) => (
              <div key={k} className="rounded-2xl bg-soft py-2">
                <dd className="text-lg font-bold tabular-nums">{Number(v).toLocaleString()}</dd>
                <dt className="text-xs text-muted">{k}</dt>
              </div>
            ))}
          </dl>
          {running && (
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-soft">
              <div className="h-full w-1/3 animate-pulse rounded-full bg-coral" />
            </div>
          )}
          {current.status === "done" && (
            <>
              {current.error && <p className="mt-3 text-xs text-muted">{current.error}</p>}
              <Link
                href="/swipe"
                className="mt-4 block rounded-full bg-ink py-3 text-center font-semibold text-card"
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
