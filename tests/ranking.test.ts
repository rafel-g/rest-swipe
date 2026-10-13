import { describe, expect, it } from "vitest";
import {
  applyFilter,
  featuresOf,
  isOpenAt,
  qualityScore,
  rankCandidates,
  updateWeights,
  WEIGHT_LIMIT,
  type Candidate,
  type Weights,
} from "@/lib/ranking";

function place(overrides: Partial<Candidate> & { place_id: string }): Candidate {
  return {
    name: overrides.place_id,
    rating: 4.3,
    rating_count: 200,
    price_level: 2,
    cuisine: "italian",
    tags: [],
    distance_mi: 5,
    hours: null,
    utc_offset_min: null,
    ...overrides,
  };
}

const noExplore = { limit: 50, maxDistMi: 25, exploreRate: 0 };

describe("qualityScore", () => {
  it("trusts a rating with many reviews more than one with few", () => {
    const many = qualityScore({ rating: 4.8, rating_count: 2000 }, 4.2);
    const few = qualityScore({ rating: 5.0, rating_count: 3 }, 4.2);
    expect(many).toBeGreaterThan(few);
  });

  it("stays within 0..1", () => {
    expect(qualityScore({ rating: 1, rating_count: 5000 }, 4.2)).toBe(0);
    expect(qualityScore({ rating: 5, rating_count: 1e6 }, 4.2)).toBeLessThanOrEqual(1);
  });
});

describe("rankCandidates", () => {
  it("ranks a better-rated, closer place first", () => {
    const ranked = rankCandidates(
      [
        place({ place_id: "worse", rating: 3.9, distance_mi: 15 }),
        place({ place_id: "better", rating: 4.7, distance_mi: 2 }),
      ],
      {},
      noExplore,
    );
    expect(ranked.map((r) => r.place_id)).toEqual(["better", "worse"]);
  });

  it("learned preferences change the order", () => {
    const cands = [
      place({ place_id: "italian", cuisine: "italian", rating: 4.5 }),
      place({ place_id: "thai", cuisine: "thai", rating: 4.4 }),
    ];
    expect(rankCandidates(cands, {}, noExplore)[0].place_id).toBe("italian");

    let weights: Weights = {};
    for (let i = 0; i < 3; i++) weights = updateWeights(weights, cands[1], "yes", null).next;
    const ranked = rankCandidates(cands, weights, noExplore);
    expect(ranked[0].place_id).toBe("thai");
    expect(ranked[0].reasons).toContain("You like Thai");
  });

  it("respects the limit", () => {
    const cands = Array.from({ length: 30 }, (_, i) => place({ place_id: `p${i}` }));
    expect(rankCandidates(cands, {}, { ...noExplore, limit: 10 })).toHaveLength(10);
  });

  it("explores an unswiped cuisine when the dice say so", () => {
    const weights: Weights = { "cuisine:italian": 2 };
    const cands = [
      place({ place_id: "it1", cuisine: "italian" }),
      place({ place_id: "it2", cuisine: "italian" }),
      place({ place_id: "korean", cuisine: "korean", rating: 4.0 }),
    ];
    const ranked = rankCandidates(cands, weights, { limit: 3, maxDistMi: 25, exploreRate: 1, rng: () => 0 });
    expect(ranked[0].place_id).toBe("korean");
    expect(ranked[0].explore).toBe(true);
  });
});

describe("updateWeights", () => {
  const thai = { cuisine: "thai", tags: ["spicy", "cheap-eats"], price_level: 1 };

  it("moves every feature toward the decision", () => {
    const yes = updateWeights({}, thai, "yes", null).next;
    expect(yes["cuisine:thai"]).toBeGreaterThan(0);
    expect(yes["tag:spicy"]).toBeGreaterThan(0);
    expect(yes["price:1"]).toBeGreaterThan(0);
    const no = updateWeights({}, thai, "no", null).next;
    expect(no["cuisine:thai"]).toBeLessThan(0);
  });

  it("price tags are not double counted", () => {
    expect(featuresOf(thai)).not.toContain("tag:cheap-eats");
  });

  it("a 'no' while browsing a cuisine doesn't penalize that cuisine", () => {
    const { next, deltas } = updateWeights({}, thai, "no", "thai");
    expect(next["cuisine:thai"]).toBeUndefined();
    expect(deltas["cuisine:thai"]).toBeUndefined();
    expect(next["tag:spicy"]).toBeLessThan(0);
  });

  it("clamps weights and reports only the applied delta", () => {
    let weights: Weights = {};
    for (let i = 0; i < 50; i++) weights = updateWeights(weights, thai, "yes", null).next;
    expect(weights["cuisine:thai"]).toBe(WEIGHT_LIMIT);
    expect(updateWeights(weights, thai, "yes", null).deltas).toEqual({});
  });

  it("deltas reverse the update exactly (undo)", () => {
    const start: Weights = { "cuisine:thai": 1.2 };
    const { next, deltas } = updateWeights(start, thai, "yes", null);
    const undone = { ...next };
    for (const [f, d] of Object.entries(deltas)) undone[f] -= d;
    expect(undone["cuisine:thai"]).toBeCloseTo(1.2);
    expect(undone["tag:spicy"]).toBeCloseTo(0);
  });
});

describe("filters and hours", () => {
  // Mon-Fri 11:00-22:00, Sat 17:00 - Sun 02:00 (crosses midnight)
  const hours = [
    ...[1, 2, 3, 4, 5].map((day) => ({ open: { day, hour: 11, minute: 0 }, close: { day, hour: 22, minute: 0 } })),
    { open: { day: 6, hour: 17, minute: 0 }, close: { day: 0, hour: 2, minute: 0 } },
  ];
  // Local time = UTC here (offset 0) to keep the dates readable. 2026-10-12 is a Monday.
  const at = (iso: string) => new Date(`${iso}Z`);

  it("knows when a place is open", () => {
    expect(isOpenAt(hours, 0, at("2026-10-12T12:00:00"))).toBe(true);
    expect(isOpenAt(hours, 0, at("2026-10-12T23:00:00"))).toBe(false);
    expect(isOpenAt(hours, 0, at("2026-10-18T01:30:00"))).toBe(true); // Sunday 1:30am, Saturday's late shift
    expect(isOpenAt(hours, 0, at("2026-10-18T03:00:00"))).toBe(false);
    expect(isOpenAt(null, 0, new Date())).toBeNull();
  });

  it("applies the local UTC offset", () => {
    // 16:00 UTC is 12:00 in UTC-4.
    expect(isOpenAt(hours, -240, at("2026-10-12T16:00:00"))).toBe(true);
    expect(isOpenAt(hours, -240, at("2026-10-12T14:00:00"))).toBe(false);
  });

  it("filters by tags, price, distance and open now", () => {
    const cands = [
      place({ place_id: "a", tags: ["date-night"], price_level: 3, distance_mi: 3, hours, utc_offset_min: 0 }),
      place({ place_id: "b", tags: ["date-night"], price_level: 1, distance_mi: 3 }),
      place({ place_id: "c", tags: [], price_level: 1, distance_mi: 20 }),
    ];
    const ids = (f: Parameters<typeof applyFilter>[1]) =>
      applyFilter(cands, f, at("2026-10-12T12:00:00")).map((c) => c.place_id);
    expect(ids({ tags: ["date-night"] })).toEqual(["a", "b"]);
    expect(ids({ maxPrice: 2 })).toEqual(["b", "c"]);
    expect(ids({ maxDistMi: 10 })).toEqual(["a", "b"]);
    expect(ids({ openNow: true })).toEqual(["a"]);
  });
});
