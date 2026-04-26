import { type SpotWithVerdict } from "@windsiren/core";
import {
  DEFAULT_THRESHOLDS,
  isHourRideable,
  type HourlyForecast,
} from "@windsiren/shared";

// Shared helpers between TodayDashboard and SpotConditionsBlock. All
// time math runs in NL local (Europe/Amsterdam) so daylight windows and
// hour labels match what a kiter actually sees on the water.

export function daylightHours(hours: HourlyForecast[]): HourlyForecast[] {
  return hours.filter((h) => {
    const localHour = nlLocalHour(new Date(h.time));
    return localHour >= 8 && localHour <= 20;
  });
}

export function nlLocalHour(d: Date): number {
  const hh = new Intl.DateTimeFormat("en-NL", {
    timeZone: "Europe/Amsterdam",
    hour: "2-digit",
    hour12: false,
  }).format(d);
  return parseInt(hh, 10);
}

export function fmtNlClock(d: Date): string {
  return new Intl.DateTimeFormat("en-NL", {
    timeZone: "Europe/Amsterdam",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(d);
}

export function pad2(n: number): string {
  return n.toString().padStart(2, "0");
}

export function countRideable(item: SpotWithVerdict): number {
  return item.hours.filter((h) =>
    isHourRideable(h, item.spot, DEFAULT_THRESHOLDS),
  ).length;
}

export function longestRideableRun(
  item: SpotWithVerdict,
): { startHour: number; endHour: number } | null {
  const daylight = daylightHours(item.hours);
  let bestStart: number | null = null;
  let bestLen = 0;
  let curStart: number | null = null;
  let curLen = 0;
  for (const h of daylight) {
    if (isHourRideable(h, item.spot, DEFAULT_THRESHOLDS)) {
      if (curStart === null) curStart = nlLocalHour(new Date(h.time));
      curLen += 1;
    } else {
      if (curLen > bestLen && curStart !== null) {
        bestStart = curStart;
        bestLen = curLen;
      }
      curStart = null;
      curLen = 0;
    }
  }
  if (curLen > bestLen && curStart !== null) {
    bestStart = curStart;
    bestLen = curLen;
  }
  if (bestStart === null || bestLen === 0) return null;
  return { startHour: bestStart, endHour: bestStart + bestLen };
}

export function weekdayShort(dateKey: string): string {
  // Pin to UTC noon so the formatter doesn't roll a date across local TZ.
  const d = new Date(`${dateKey}T12:00:00Z`);
  return d
    .toLocaleDateString("en-NL", { weekday: "short", timeZone: "Europe/Amsterdam" })
    .toUpperCase();
}
