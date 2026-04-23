// Conversion helpers. Storage + logic stay in SI; these are only for display.

const MS_TO_KNOTS = 1.943844;

export function msToKnots(ms: number): number {
  return ms * MS_TO_KNOTS;
}

export function knotsToMs(kn: number): number {
  return kn / MS_TO_KNOTS;
}

export function cardinalDirection(deg: number): string {
  const normalized = ((deg % 360) + 360) % 360;
  const directions = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];
  const index = Math.round(normalized / 22.5) % 16;
  return directions[index]!;
}
