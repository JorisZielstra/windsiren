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
  verdict: Verdict | null; // null = fetch failed
  hours: HourlyForecast[]; // today's hourly forecast (may be empty on error)
};

// Single forecaster reused across requests. Safe because it's stateless except
// for an injected fetch, which Node dedupes by default.
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
    // Fetch or evaluation failure should never break the page — surface as null verdict.
    return { spot, verdict: null, hours: [] };
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
