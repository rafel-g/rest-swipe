export type LatLng = { lat: number; lng: number };

const EARTH_RADIUS_MI = 3958.8;
const METERS_PER_MILE = 1609.344;
const toRad = (deg: number) => (deg * Math.PI) / 180;
const toDeg = (rad: number) => (rad * 180) / Math.PI;

export const milesToMeters = (mi: number) => mi * METERS_PER_MILE;
export const metersToMiles = (m: number) => m / METERS_PER_MILE;

/** Great-circle distance in miles. */
export function haversineMiles(a: LatLng, b: LatLng): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_MI * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Move a point east (dxMi) and north (dyMi). Accurate enough at the ~25 mile scale. */
export function offsetLatLng(origin: LatLng, dxMi: number, dyMi: number): LatLng {
  const lat = origin.lat + toDeg(dyMi / EARTH_RADIUS_MI);
  const lng = origin.lng + toDeg(dxMi / (EARTH_RADIUS_MI * Math.cos(toRad(origin.lat))));
  return { lat, lng };
}
