import {
  averageDirectionDeg,
} from "./sessions";
import {
  DEFAULT_THRESHOLDS,
  isHourRideable,
  type HourlyForecast,
  type Spot,
} from "@windsiren/shared";

export type HourBucket = {
  // ISO timestamp of the first hour in the bucket. Useful as a stable key.
  startTime: string;
  // NL local hour of the bucket's start, 0–23.
  startLocalHour: number;
  // NL local date key (YYYY-MM-DD) the bucket falls in. A bucket never
  // spans a date boundary because we always bucket hours within a single
  // pre-grouped day.
  dateKey: string;
  // Number of hours in the bucket (1 or 2 — last bucket may be partial).
  hourCount: number;
  // Aggregates. Wind = mean, gust = max, direction = vector mean,
  // temp = mean, precip = sum.
  windSpeedMs: number;
  gustMs: number;
  windDirectionDeg: number;
  airTempC: number;
  precipitationMm: number;
  // Rideable when at least half the contained hours pass the spot's
  // threshold check. Single-hour buckets fall back to the hour's own
  // verdict.
  rideable: boolean;
};

// Buckets hourly forecasts into N-hour windows aligned to the start of
// the day in NL local time. Defaults to 2 hours (Windguru cadence);
// pass 1 to keep raw hours.
//
// Multi-day safe: hours spanning N days produce up to N × (24/windowSize)
// buckets, in chronological order. Each bucket is keyed on
// (NL-date, hour-window) so different days never collide.
export function bucketHours(
  hours: HourlyForecast[],
  spot: Spot,
  windowSize: number = 2,
): HourBucket[] {
  if (hours.length === 0) return [];

  type Key = string; // `${dateKey}|${bucketIdx}`
  const grouped = new Map<Key, HourlyForecast[]>();
  const order: Key[] = [];
  for (const h of hours) {
    const d = new Date(h.time);
    const dateKey = nlLocalDateKey(d);
    const localHour = nlLocalHour(d);
    const bucketIdx = Math.floor(localHour / windowSize);
    const key: Key = `${dateKey}|${bucketIdx}`;
    let arr = grouped.get(key);
    if (!arr) {
      arr = [];
      grouped.set(key, arr);
      order.push(key);
    }
    arr.push(h);
  }

  return order.map((key) => {
    const bucket = grouped.get(key)!;
    const first = bucket[0]!;
    const [dateKey, idxStr] = key.split("|");
    const startLocalHour = parseInt(idxStr!, 10) * windowSize;

    const winds = bucket.map((h) => h.windSpeedMs);
    const gusts = bucket.map((h) => h.gustMs);
    const dirs = bucket.map((h) => h.windDirectionDeg);
    const temps = bucket.map((h) => h.airTempC);
    const rains = bucket.map((h) => h.precipitationMm);

    const rideableCount = bucket.filter((h) =>
      isHourRideable(h, spot, DEFAULT_THRESHOLDS),
    ).length;

    return {
      startTime: first.time,
      startLocalHour,
      dateKey: dateKey!,
      hourCount: bucket.length,
      windSpeedMs: mean(winds),
      gustMs: Math.max(...gusts),
      windDirectionDeg: averageDirectionDeg(dirs),
      airTempC: mean(temps),
      precipitationMm: rains.reduce((s, x) => s + x, 0),
      rideable: rideableCount >= bucket.length / 2,
    };
  });
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

function nlLocalDateKey(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Amsterdam",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}
