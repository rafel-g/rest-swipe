/**
 * Friends & family — PREVIEW ONLY.
 *
 * TODO: replace with /api/friends + real swipes. Friends live in this browser's localStorage,
 * and what each friend "liked" is faked with a stable hash, so matches look real and don't
 * change on reload. Everything that needs swapping out is in this file.
 */

import { useSyncExternalStore } from "react";

export type Relation = "household" | "family" | "friend";

export type Friend = { id: string; name: string; relation: Relation; addedAt: string };

export const RELATIONS: { value: Relation; label: string }[] = [
  { value: "household", label: "Household" },
  { value: "family", label: "Family" },
  { value: "friend", label: "Friend" },
];

const KEY = "rs.friends";
const CHANGE = "rs:friends";
const EMPTY: Friend[] = [];

// Cache by raw string so useSyncExternalStore gets the same array until storage changes.
let cached: { raw: string | null; friends: Friend[] } = { raw: null, friends: EMPTY };

function read(): Friend[] {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(KEY);
  } catch {
    return EMPTY;
  }
  if (raw === cached.raw) return cached.friends;
  let friends = EMPTY;
  try {
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    if (Array.isArray(parsed)) friends = parsed as Friend[];
  } catch {}
  cached = { raw, friends };
  return friends;
}

function write(friends: Friend[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(friends));
  } catch {}
  window.dispatchEvent(new Event(CHANGE));
}

function subscribe(onChange: () => void) {
  window.addEventListener(CHANGE, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(CHANGE, onChange);
    window.removeEventListener("storage", onChange);
  };
}

/** The people you've added. Empty during server render. */
export function useFriends() {
  return useSyncExternalStore(subscribe, read, () => EMPTY);
}

export function addFriend(name: string, relation: Relation): Friend {
  const friend = { id: crypto.randomUUID(), name: name.trim(), relation, addedAt: new Date().toISOString() };
  write([...read(), friend]);
  return friend;
}

export function removeFriend(id: string) {
  write(read().filter((f) => f.id !== id));
}

/** FNV-1a: a small, stable string hash. */
function hash(s: string) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193);
  return h >>> 0;
}

/** Fake: whether this friend swiped right on the place. True for about 40% of places. */
export const friendLikes = (friendId: string, placeId: string) => hash(`${friendId}:${placeId}`) % 100 < 40;

export const matchesWith = <T extends { place_id: string }>(friend: Friend, saved: T[]) =>
  saved.filter((r) => friendLikes(friend.id, r.place_id));

/**
 * Demo: on the first right-swipe from this swipe number on, always show a match, so the
 * feature can be shown off without hunting for a card a friend happened to "like".
 */
export const DEMO_MATCH_AT = 3;

/** Who the demo match is with when you haven't added anyone yet. */
export const DEMO_FRIEND: Friend = { id: "demo-sam", name: "Sam", relation: "household", addedAt: "2026-01-01T00:00:00Z" };

/** Household first, since that's who you're most likely deciding dinner with. */
export const demoMatchFriend = (friends: Friend[]) =>
  friends.find((f) => f.relation === "household") ?? friends[0] ?? DEMO_FRIEND;

export const likedBy = (friends: Friend[], placeId: string) => friends.filter((f) => friendLikes(f.id, placeId));

export const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("");

const AVATAR_TINTS = ["bg-peach", "bg-sage", "bg-soft", "bg-sage-2"];
export const avatarTint = (friend: Friend) => AVATAR_TINTS[hash(friend.id) % AVATAR_TINTS.length];

/** "Sam", "Sam & Alex", "Sam +2" */
export function namesLabel(friends: Friend[]) {
  if (friends.length <= 2) return friends.map((f) => f.name).join(" & ");
  return `${friends[0].name} +${friends.length - 1}`;
}
