// App-level helpers shared between web + mobile. Wire @windsiren/providers
// and @windsiren/supabase to @windsiren/shared's decision engine. No React,
// no DOM/RN APIs — consumable from server and client alike.

import {
  KnmiObservationSource,
  OpenMeteoForecastSource,
  RijkswaterstaatTideSource,
} from "@windsiren/providers";
import {
  evaluateDay,
  DEFAULT_THRESHOLDS,
  type DirectionRange,
  type HourlyForecast,
  type Observation,
  type Spot,
  type TidePoint,
  type Verdict,
} from "@windsiren/shared";
import type { SpotRow } from "@windsiren/supabase";

export type SpotWithVerdict = {
  spot: Spot;
  verdict: Verdict | null;
  hours: HourlyForecast[];
};

export type DayGroup = {
  dateKey: string;           // "YYYY-MM-DD" in NL local time
  hours: HourlyForecast[];
};

// Single forecaster reused across calls. Stateless apart from injected fetch.
const forecaster = new OpenMeteoForecastSource();
const tideSource = new RijkswaterstaatTideSource();

export function dbRowToSpot(row: SpotRow): Spot {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    countryCode: row.country_code,
    lat: Number(row.lat),
    lng: Number(row.lng),
    safeWindDirections: row.safe_wind_directions as unknown as DirectionRange[],
    tideSensitive: row.tide_sensitive,
    hazards: row.hazards,
    knmiStationId: row.knmi_station_id,
    rwsTideStationId: row.rws_tide_station_id,
  };
}

export async function fetchTodayVerdict(spot: Spot): Promise<SpotWithVerdict> {
  try {
    const hours = await forecaster.fetchHourly(spot.lat, spot.lng, 1);
    const verdict = evaluateDay({ spot, hours, thresholds: DEFAULT_THRESHOLDS });
    return { spot, verdict, hours };
  } catch {
    return { spot, verdict: null, hours: [] };
  }
}

export async function fetch3DayForecast(spot: Spot): Promise<HourlyForecast[]> {
  return forecaster.fetchHourly(spot.lat, spot.lng, 3);
}

export type LiveObservation = {
  observation: Observation;
  ageMinutes: number;
};

// Fetches the most recent KNMI 10-min observation for a spot's nearest
// station. Returns null when the spot has no knmi_station_id configured,
// or when the fetch/parse fails — callers render a graceful "not available"
// state rather than surfacing errors to users.
// Fetches astronomical tide extremes (high/low events) for a spot on a
// given NL-local date. Returns [] when the spot has no rws_tide_station_id
// (IJsselmeer spots, or un-mapped spots), or when the fetch fails. Never
// throws — callers render "no tide data" gracefully.
export async function fetchDailyTides(spot: Spot, dateKey: string): Promise<TidePoint[]> {
  if (!spot.rwsTideStationId) return [];
  try {
    return await tideSource.fetchDailyEvents(spot.rwsTideStationId, dateKey);
  } catch {
    return [];
  }
}

export async function fetchLiveObservation(
  spot: Spot,
  apiKey: string | undefined,
  now: Date = new Date(),
): Promise<LiveObservation | null> {
  if (!spot.knmiStationId) return null;
  if (!apiKey) return null;
  try {
    const source = new KnmiObservationSource(apiKey);
    const obs = await source.fetchLatest(spot.knmiStationId);
    const ageMs = now.getTime() - new Date(obs.observedAt).getTime();
    return { observation: obs, ageMinutes: Math.max(0, Math.round(ageMs / 60000)) };
  } catch {
    return null;
  }
}

export function averageWindMs(hours: HourlyForecast[]): number | null {
  if (hours.length === 0) return null;
  return hours.reduce((s, h) => s + h.windSpeedMs, 0) / hours.length;
}

export function peakWindMs(hours: HourlyForecast[]): number | null {
  if (hours.length === 0) return null;
  return Math.max(...hours.map((h) => h.windSpeedMs));
}

// Picks the most-relevant spot to feature on a "today" hero. Score:
// go > marginal > no_go > no-data. Tiebreaker: higher peak wind wins.
// Returns null only if the input list is empty.
export function pickHeroSpot<T extends SpotWithVerdict>(items: T[]): T | null {
  if (items.length === 0) return null;
  const score = (decision: "go" | "marginal" | "no_go" | undefined): number => {
    if (decision === "go") return 3;
    if (decision === "marginal") return 2;
    if (decision === "no_go") return 1;
    return 0;
  };
  return items.reduce((best, current) => {
    const bestScore = score(best.verdict?.decision);
    const curScore = score(current.verdict?.decision);
    if (curScore > bestScore) return current;
    if (curScore < bestScore) return best;
    const bestPeak = peakWindMs(best.hours) ?? 0;
    const curPeak = peakWindMs(current.hours) ?? 0;
    return curPeak > bestPeak ? current : best;
  });
}

const NL_TZ = "Europe/Amsterdam";

export function groupHoursByLocalDay(hours: HourlyForecast[]): DayGroup[] {
  const keyFormatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: NL_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  const groups = new Map<string, HourlyForecast[]>();
  for (const hour of hours) {
    const key = keyFormatter.format(new Date(hour.time));
    const bucket = groups.get(key);
    if (bucket) {
      bucket.push(hour);
    } else {
      groups.set(key, [hour]);
    }
  }
  return Array.from(groups, ([dateKey, hours]) => ({ dateKey, hours }));
}

export function formatDayLabel(dateKey: string): string {
  const d = new Date(`${dateKey}T00:00:00+01:00`);
  return new Intl.DateTimeFormat("en-NL", {
    timeZone: NL_TZ,
    weekday: "long",
    month: "short",
    day: "numeric",
  }).format(d);
}

export function formatHourLabel(isoTime: string): string {
  return new Intl.DateTimeFormat("en-NL", {
    timeZone: NL_TZ,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(isoTime));
}
