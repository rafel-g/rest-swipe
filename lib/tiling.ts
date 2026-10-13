import { haversineMiles, offsetLatLng, type LatLng } from "./geo";

export type Tile = { center: LatLng; radiusMi: number; depth: number };

/**
 * Cover a circle of `radiusMi` around `origin` with overlapping circles of `tileRadiusMi`.
 * Centers sit on a triangular lattice with spacing r*sqrt(3), which covers the plane with
 * no gaps; we keep every center whose circle can reach the target circle.
 */
export function buildTiles(origin: LatLng, radiusMi: number, tileRadiusMi: number): Tile[] {
  const spacing = tileRadiusMi * Math.sqrt(3);
  const rowHeight = spacing * (Math.sqrt(3) / 2);
  const reach = radiusMi + tileRadiusMi;
  const rows = Math.ceil(reach / rowHeight) + 1;
  const cols = Math.ceil(reach / spacing) + 1;
  const tiles: Tile[] = [];
  for (let row = -rows; row <= rows; row++) {
    const xShift = row % 2 === 0 ? 0 : spacing / 2;
    for (let col = -cols; col <= cols; col++) {
      const dx = col * spacing + xShift;
      const dy = row * rowHeight;
      if (Math.hypot(dx, dy) < reach) {
        tiles.push({ center: offsetLatLng(origin, dx, dy), radiusMi: tileRadiusMi, depth: 0 });
      }
    }
  }
  return tiles;
}

/**
 * Split a saturated tile into 7 children of half the radius: one in the middle and six on a
 * ring at r*sqrt(3)/2. Seven circles of radius r/2 placed this way exactly cover the parent.
 */
export function subdivideTile(tile: Tile): Tile[] {
  const r = tile.radiusMi / 2;
  // Slightly enlarge children so floating point and the flat-earth offset leave no slivers.
  const childRadius = r * 1.02;
  const ring = tile.radiusMi * (Math.sqrt(3) / 2);
  const children: Tile[] = [{ center: tile.center, radiusMi: childRadius, depth: tile.depth + 1 }];
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 3) * i + Math.PI / 6;
    children.push({
      center: offsetLatLng(tile.center, ring * Math.cos(angle), ring * Math.sin(angle)),
      radiusMi: childRadius,
      depth: tile.depth + 1,
    });
  }
  return children;
}

/**
 * Smallest tile radius (in 0.5 mi steps, at least `minTileRadiusMi`) whose initial grid fits in
 * `share` of the request budget, leaving the rest for splitting dense tiles. Smaller tiles mean
 * more restaurants found, since each call returns at most 20.
 */
export function chooseTileRadius(
  radiusMi: number,
  maxRequests: number,
  { share = 0.7, minTileRadiusMi = 2, maxTileRadiusMi = 31 } = {},
): number {
  const origin = { lat: 0, lng: 0 };
  const budget = Math.max(1, Math.floor(maxRequests * share));
  for (let r = minTileRadiusMi; r < maxTileRadiusMi; r += 0.5) {
    if (buildTiles(origin, radiusMi, r).length <= budget) return r;
  }
  return maxTileRadiusMi;
}

export function tileCovers(tile: Tile, point: LatLng): boolean {
  return haversineMiles(tile.center, point) <= tile.radiusMi;
}
