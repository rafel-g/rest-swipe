import { describe, expect, it } from "vitest";
import { haversineMiles, offsetLatLng, type LatLng } from "@/lib/geo";
import { buildTiles, chooseTileRadius, subdivideTile, tileCovers } from "@/lib/tiling";

// Deterministic pseudo-random points so failures are reproducible.
function seededRng(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 2 ** 32;
    return seed / 2 ** 32;
  };
}

function randomPointsInCircle(center: LatLng, radiusMi: number, n: number) {
  const rng = seededRng(42);
  return Array.from({ length: n }, () => {
    const r = radiusMi * Math.sqrt(rng());
    const a = 2 * Math.PI * rng();
    return offsetLatLng(center, r * Math.cos(a), r * Math.sin(a));
  });
}

describe("haversineMiles", () => {
  it("matches a known distance (NYC to Philadelphia ~80 mi)", () => {
    const d = haversineMiles({ lat: 40.7128, lng: -74.006 }, { lat: 39.9526, lng: -75.1652 });
    expect(d).toBeGreaterThan(78);
    expect(d).toBeLessThan(82);
  });

  it("agrees with offsetLatLng", () => {
    const origin = { lat: 34.05, lng: -118.25 };
    expect(haversineMiles(origin, offsetLatLng(origin, 3, 4))).toBeCloseTo(5, 1);
  });
});

describe("buildTiles", () => {
  const origin = { lat: 41.88, lng: -87.63 };

  it("covers every point in the 25 mile circle with no gaps", () => {
    const tiles = buildTiles(origin, 25, 4);
    const points = randomPointsInCircle(origin, 25, 5000);
    const uncovered = points.filter((p) => !tiles.some((t) => tileCovers(t, p)));
    expect(uncovered).toHaveLength(0);
  });

  it("uses a sensible number of tiles", () => {
    const n = buildTiles(origin, 25, 4).length;
    expect(n).toBeGreaterThan(40);
    expect(n).toBeLessThan(90);
  });
});

describe("subdivideTile", () => {
  it("children fully cover the parent", () => {
    const parent = { center: { lat: 47.6, lng: -122.33 }, radiusMi: 4, depth: 0 };
    const children = subdivideTile(parent);
    expect(children).toHaveLength(7);
    expect(children.every((c) => c.depth === 1 && c.radiusMi < parent.radiusMi)).toBe(true);
    const points = randomPointsInCircle(parent.center, parent.radiusMi, 5000);
    const uncovered = points.filter((p) => !children.some((c) => tileCovers(c, p)));
    expect(uncovered).toHaveLength(0);
  });
});

describe("chooseTileRadius", () => {
  it("fits a 25 mile sweep's first pass into 70% of a 60 call budget", () => {
    const r = chooseTileRadius(25, 60);
    const tiles = buildTiles({ lat: 30.27, lng: -97.74 }, 25, r);
    expect(tiles.length).toBeLessThanOrEqual(42);
    expect(r).toBeLessThanOrEqual(6);
  });

  it("uses smaller tiles when the budget allows", () => {
    expect(chooseTileRadius(25, 400)).toBeLessThan(chooseTileRadius(25, 60));
  });

  it("the chosen grid still covers the whole circle", () => {
    const origin = { lat: 30.27, lng: -97.74 };
    const tiles = buildTiles(origin, 25, chooseTileRadius(25, 60));
    const points = randomPointsInCircle(origin, 25, 3000);
    expect(points.filter((p) => !tiles.some((t) => tileCovers(t, p)))).toHaveLength(0);
  });
});
