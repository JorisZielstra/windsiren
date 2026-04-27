import { type SpotWithVerdict } from "@windsiren/core";
import {
  DEFAULT_THRESHOLDS,
  isHourRideable,
  type HourlyForecast,
} from "@windsiren/shared";

// Shared helpers between TodayDashboard and SpotConditionsBlock on mobile.
// All time math runs in NL local (Europe/Amsterdam).

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
  const d = new Date(`${dateKey}T12:00:00Z`);
  return d
    .toLocaleDateString("en-NL", { weekday: "short", timeZone: "Europe/Amsterdam" })
    .toUpperCase();
}

export function mondayOfDate(dateKey: string): string {
  const d = new Date(`${dateKey}T12:00:00Z`);
  const dow = d.getUTCDay();
  const offset = dow === 0 ? -6 : 1 - dow;
  d.setUTCDate(d.getUTCDate() + offset);
  return d.toISOString().slice(0, 10);
}

export function addDaysToKey(dateKey: string, days: number): string {
  const d = new Date(`${dateKey}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function weekDates(monday: string): string[] {
  return Array.from({ length: 7 }, (_, i) => addDaysToKey(monday, i));
}

const NL_WEEKDAYS_SHORT = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
export function formatWeekdayDate(dateKey: string): string {
  const d = new Date(`${dateKey}T12:00:00Z`);
  const localDate = new Date(
    d.toLocaleString("en-US", { timeZone: "Europe/Amsterdam" }),
  );
  const weekday = NL_WEEKDAYS_SHORT[localDate.getDay()] ?? "";
  const day = parseInt(dateKey.slice(8, 10), 10);
  const month = parseInt(dateKey.slice(5, 7), 10);
  return `${weekday} ${day}/${month}`;
}
