import type { DirectionRange } from "@windsiren/shared";

// Wind-rose geometry helpers. Pure functions — platform-independent so the
// web (SVG) and mobile (react-native-svg) components share one source of truth.

export type Point = { x: number; y: number };

// Compass degrees -> (x, y) on a circle where 0° = north (top).
// SVG y grows downward, so we subtract from cy for the y coordinate.
export function polarToCartesian(
  cx: number,
  cy: number,
  radius: number,
  angleDeg: number,
): Point {
  const rad = (angleDeg * Math.PI) / 180;
  return {
    x: cx + radius * Math.sin(rad),
    y: cy - radius * Math.cos(rad),
  };
}

// SVG path for a clockwise pie sector from `fromDeg` to `toDeg`. Wraps
// through 360° if toDeg < fromDeg. Used to fill the spot's safe wind window.
export function sectorPath(
  cx: number,
  cy: number,
  radius: number,
  fromDeg: number,
  toDeg: number,
): string {
  const from = normalizeDeg(fromDeg);
  const to = normalizeDeg(toDeg);
  const start = polarToCartesian(cx, cy, radius, from);
  const end = polarToCartesian(cx, cy, radius, to);
  const sweep = ((to - from) % 360 + 360) % 360;
  // 0° sweep would collapse to a line — draw a full circle for that edge case.
  if (sweep === 0) {
    return fullCirclePath(cx, cy, radius);
  }
  const largeArcFlag = sweep > 180 ? 1 : 0;
  return [
    `M ${cx} ${cy}`,
    `L ${start.x} ${start.y}`,
    `A ${radius} ${radius} 0 ${largeArcFlag} 1 ${end.x} ${end.y}`,
    "Z",
  ].join(" ");
}

// SVG path for a full circle (fallback used by sectorPath when the sector
// would otherwise collapse to zero width).
export function fullCirclePath(cx: number, cy: number, radius: number): string {
  return [
    `M ${cx - radius} ${cy}`,
    `A ${radius} ${radius} 0 1 0 ${cx + radius} ${cy}`,
    `A ${radius} ${radius} 0 1 0 ${cx - radius} ${cy}`,
    "Z",
  ].join(" ");
}

// Normalize any real number to [0, 360).
export function normalizeDeg(deg: number): number {
  return ((deg % 360) + 360) % 360;
}

// Convenience: endpoint of a "needle" from center pointing outward at the
// given direction (so the tip lands on the circle edge).
export function needleEndpoint(
  cx: number,
  cy: number,
  radius: number,
  directionDeg: number,
): Point {
  return polarToCartesian(cx, cy, radius, directionDeg);
}

// Cardinal label positions around the circle at N / E / S / W.
export function cardinalLabelPositions(cx: number, cy: number, radius: number) {
  return {
    N: polarToCartesian(cx, cy, radius, 0),
    E: polarToCartesian(cx, cy, radius, 90),
    S: polarToCartesian(cx, cy, radius, 180),
    W: polarToCartesian(cx, cy, radius, 270),
  };
}

// Build geometry for all safe direction sectors of a spot.
export function safeSectorPaths(
  cx: number,
  cy: number,
  radius: number,
  directions: DirectionRange[],
): string[] {
  return directions.map((d) => sectorPath(cx, cy, radius, d.from, d.to));
}
