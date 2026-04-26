import type { HourlyForecast } from "@windsiren/shared";

export type WindTrend = "rising" | "holding" | "dropping";

// Threshold (m/s) for declaring a trend rather than "holding". 1 m/s ≈ 2 kn,
// which is the smallest change an average kiter would actually feel.
const TREND_THRESHOLD_MS = 1;

// Minimum daylight hours we need to even attempt a trend; below this we
// bail to "holding" rather than draw a misleading arrow off two samples.
const MIN_HOURS_FOR_TREND = 4;

// Classifies the wind direction-of-change across today's daylight hours
// (08:00–20:00 NL local). Splits the daylight window in half by hour count
// and compares the mean wind speed of each half. Pure function; takes the
// raw hourly forecast and returns a coarse label for a UI badge.
export function classifyWindTrend(hours: HourlyForecast[]): WindTrend {
  const daylight = hours.filter((h) => {
    const localHour = nlLocalHour(new Date(h.time));
    return localHour >= 8 && localHour <= 20;
  });
  if (daylight.length < MIN_HOURS_FOR_TREND) return "holding";

  const mid = Math.floor(daylight.length / 2);
  const first = daylight.slice(0, mid);
  const second = daylight.slice(mid);

  const firstAvg = mean(first.map((h) => h.windSpeedMs));
  const secondAvg = mean(second.map((h) => h.windSpeedMs));
  const diff = secondAvg - firstAvg;

  if (Math.abs(diff) < TREND_THRESHOLD_MS) return "holding";
  return diff > 0 ? "rising" : "dropping";
}

function mean(xs: number[]): number {
  return xs.reduce((s, x) => s + x, 0) / xs.length;
}

function nlLocalHour(d: Date): number {
  const hh = new Intl.DateTimeFormat("en-NL", {
    timeZone: "Europe/Amsterdam",
    hour: "2-digit",
    hour12: false,
  }).format(d);
  return parseInt(hh, 10);
}
