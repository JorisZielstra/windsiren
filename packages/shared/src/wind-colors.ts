// Continuous color scale for wind speed in knots. Pure function, shared
// between web + mobile so every surface that shows a kn value (forecast
// table cells, weather strip, session hero) tints consistently.
//
// Design rationale:
//   - 0 kn = transparent (no information; don't paint).
//   - Bands rise through cool→warm→hot→cosmic to hint at intensity:
//       1–10 → pale blue (gentle, undersurfboard)
//       10–15 → light green (kiteable for big kites)
//       15–20 → light yellow (mid sweet-spot)
//       20–25 → light orange (strong)
//       25–30 → orange (gusty/strong)
//       30–35 → red (storm territory)
//       35–40 → dark purple (don't kite)
//       40+   → very dark purple (definitely don't)
//   - RGB linear interpolation (avoids the hue-wrap issue HSL has at the
//     red→purple step).
//   - Foreground text contrast computed from relative luminance (WCAG)
//     so callers don't need to manage it separately.

export type WindColor = {
  bg: string; // CSS color string ("transparent" or "#rrggbb")
  fg: string; // CSS color string for text on top of `bg`
};

type RGB = [number, number, number];

type Stop = { kn: number; rgb: RGB };

// Stops at the user's reference points. Hex values are picked from the
// Tailwind palette so adjacent UI elements stay in the same vocabulary.
const STOPS: Stop[] = [
  { kn: 1, rgb: [240, 249, 255] }, // sky-50  — barely visible at 1 kn
  { kn: 10, rgb: [125, 211, 252] }, // sky-300 = "light blue" target
  { kn: 15, rgb: [134, 239, 172] }, // green-300 = "light green" target
  { kn: 20, rgb: [253, 224, 71] }, // yellow-300 = "light yellow" target
  { kn: 25, rgb: [251, 146, 60] }, // orange-400 = "light orange" target
  { kn: 30, rgb: [234, 88, 12] }, // orange-600 = "darker orange" target
  { kn: 35, rgb: [185, 28, 28] }, // red-700 = "dark red" target
  { kn: 40, rgb: [107, 33, 168] }, // purple-800 = "dark purple" target
  { kn: 45, rgb: [76, 29, 149] }, // violet-900 = "darker purple" anchor
];

const NEUTRAL_FG = "#71717a"; // zinc-500 — used when bg is transparent

export function windKnColor(kn: number): WindColor {
  if (!Number.isFinite(kn) || kn <= 0) {
    return { bg: "transparent", fg: NEUTRAL_FG };
  }

  // Above the last stop, use the last stop's color (don't extrapolate
  // into nonsensical RGB territory).
  const last = STOPS[STOPS.length - 1]!;
  if (kn >= last.kn) {
    return { bg: rgbToHex(last.rgb), fg: textOn(last.rgb) };
  }

  // Below the first stop, fade from transparent → first stop.
  const first = STOPS[0]!;
  if (kn < first.kn) {
    const t = kn / first.kn;
    const rgb = lerpRgb([255, 255, 255], first.rgb, t);
    return { bg: rgbToHex(rgb), fg: textOn(rgb) };
  }

  // Find the bracketing stops and interpolate.
  for (let i = 0; i < STOPS.length - 1; i++) {
    const a = STOPS[i]!;
    const b = STOPS[i + 1]!;
    if (kn >= a.kn && kn <= b.kn) {
      const t = (kn - a.kn) / (b.kn - a.kn);
      const rgb = lerpRgb(a.rgb, b.rgb, t);
      return { bg: rgbToHex(rgb), fg: textOn(rgb) };
    }
  }

  // Unreachable; fall back to neutral.
  return { bg: "transparent", fg: NEUTRAL_FG };
}

function lerpRgb(a: RGB, b: RGB, t: number): RGB {
  const c = Math.max(0, Math.min(1, t));
  return [
    Math.round(a[0] + (b[0] - a[0]) * c),
    Math.round(a[1] + (b[1] - a[1]) * c),
    Math.round(a[2] + (b[2] - a[2]) * c),
  ];
}

function rgbToHex(rgb: RGB): string {
  const hh = (n: number) => n.toString(16).padStart(2, "0");
  return `#${hh(rgb[0])}${hh(rgb[1])}${hh(rgb[2])}`;
}

// WCAG relative luminance + dark/light text decision.
function textOn(bg: RGB): string {
  const lum = relativeLuminance(bg);
  return lum > 0.55 ? "#1f2937" : "#ffffff"; // zinc-800 or white
}

function relativeLuminance(rgb: RGB): number {
  const [r, g, b] = rgb.map((c) => {
    const cs = c / 255;
    return cs <= 0.03928 ? cs / 12.92 : Math.pow((cs + 0.055) / 1.055, 2.4);
  }) as RGB;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
