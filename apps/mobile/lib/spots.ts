import { OpenMeteoForecastSource } from "@windsiren/providers";
import {
  evaluateDay,
  INTERMEDIATE_THRESHOLDS,
  type DirectionRange,
  type HourlyForecast,
  type Spot,
  type Verdict,
} from "@windsiren/shared";
import type { SpotRow } from "@windsiren/supabase";

export type SpotWithVerdict = {
  spot: Spot;
  verdict: Verdict | null;
  hours: HourlyForecast[];
};

const forecaster = new OpenMeteoForecastSource();

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
    const verdict = evaluateDay({ spot, hours, thresholds: INTERMEDIATE_THRESHOLDS });
    return { spot, verdict, hours };
  } catch {
    return { spot, verdict: null, hours: [] };
  }
}

export async function fetch3DayForecast(spot: Spot): Promise<HourlyForecast[]> {
  return forecaster.fetchHourly(spot.lat, spot.lng, 3);
}

export function peakWindMs(hours: HourlyForecast[]): number | null {
  if (hours.length === 0) return null;
  return Math.max(...hours.map((h) => h.windSpeedMs));
}

export type DayGroup = {
  dateKey: string;
  hours: HourlyForecast[];
};

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
