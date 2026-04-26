import { OpenMeteoForecastSource } from "@windsiren/providers";
import {
  evaluateDay,
  DEFAULT_THRESHOLDS,
  type HourlyForecast,
  type Spot,
  type Verdict,
} from "@windsiren/shared";

export type DayVerdict = {
  // "YYYY-MM-DD" in NL local time. Matches the format used elsewhere
  // (sessions.session_date, rsvps.planned_date) so it's safe to compare.
  dateKey: string;
  verdict: Verdict | null;
  hours: HourlyForecast[];
};

export type SpotWeek = {
  spot: Spot;
  days: DayVerdict[];
};

const forecaster = new OpenMeteoForecastSource();

// Fetches the next `days` of hourly forecast for a spot and partitions
// the result into per-NL-day verdicts. Each day's verdict runs the same
// decision engine that `fetchTodayVerdict` uses, so the headline scoring
// is consistent across "today" and "this week".
//
// Returns null verdicts on fetch failure (per-day fallback) — callers
// render "no data" gracefully.
export async function fetchSpotWeek(spot: Spot, days = 7): Promise<SpotWeek> {
  try {
    const hours = await forecaster.fetchHourly(spot.lat, spot.lng, days);
    return { spot, days: partitionByDay(spot, hours) };
  } catch {
    return { spot, days: [] };
  }
}

// Pure: partition raw hourly forecasts into per-NL-day groups, run the
// decision engine on each. Exposed separately so tests don't need a
// network stub and so callers can pass alternate hours arrays.
export function partitionByDay(spot: Spot, hours: HourlyForecast[]): DayVerdict[] {
  if (hours.length === 0) return [];

  // Group hours by their NL local date.
  const grouped = new Map<string, HourlyForecast[]>();
  const dateOrder: string[] = [];
  for (const h of hours) {
    const key = nlLocalDateKey(new Date(h.time));
    let bucket = grouped.get(key);
    if (!bucket) {
      bucket = [];
      grouped.set(key, bucket);
      dateOrder.push(key);
    }
    bucket.push(h);
  }

  return dateOrder.map((dateKey) => {
    const dayHours = grouped.get(dateKey)!;
    const verdict = evaluateDay({
      spot,
      hours: dayHours,
      thresholds: DEFAULT_THRESHOLDS,
    });
    return { dateKey, verdict, hours: dayHours };
  });
}

function nlLocalDateKey(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Amsterdam",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}
