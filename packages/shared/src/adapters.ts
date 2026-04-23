import type { HourlyForecast, Observation, StationInfo, TidePoint } from "./types.js";

// The swappable contracts. Every external data source (weather, tide,
// observations) is an implementation of one of these interfaces. No
// provider-specific fields may leak past these boundaries.

export interface ForecastSource {
  readonly name: string;
  fetchHourly(lat: number, lng: number, days: number): Promise<HourlyForecast[]>;
  supportsRegion(countryCode: string): boolean;
}

export interface ObservationSource {
  readonly name: string;
  fetchLatest(stationId: string): Promise<Observation>;
  listStationsNear(lat: number, lng: number, radiusKm: number): Promise<StationInfo[]>;
}

export interface TideSource {
  readonly name: string;
  // Returns the high/low events for the given date (local time of the spot).
  fetchDailyEvents(stationId: string, date: string): Promise<TidePoint[]>;
}

// Per-region mapping: which provider serves which concern for which country.
// This is configuration, not code — swapping providers for NL is a one-line change.

export type ProviderName =
  | "openweathermap"
  | "meteoblue"
  | "open_meteo"
  | "knmi"
  | "buienradar"
  | "rijkswaterstaat"
  | "stormglass";

export type RegionConfig = {
  forecast: ProviderName;
  observations: ProviderName;
  tides: ProviderName;
  waterTemp: ProviderName;
};

export const REGION_PROVIDERS: Record<string, RegionConfig> = {
  NL: {
    forecast: "openweathermap",
    observations: "knmi",
    tides: "rijkswaterstaat",
    waterTemp: "rijkswaterstaat",
  },
};
