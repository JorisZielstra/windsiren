import type { ForecastSource, HourlyForecast } from "@windsiren/shared";

const OPEN_METEO_BASE = "https://api.open-meteo.com/v1/forecast";

// Shape of Open-Meteo's response (only the fields we request + consume).
type OpenMeteoResponse = {
  hourly: {
    time: string[];
    temperature_2m: number[];
    wind_speed_10m: number[];
    wind_gusts_10m: number[];
    wind_direction_10m: number[];
    precipitation: number[];
    cloud_cover: number[];
  };
};

export class OpenMeteoForecastSource implements ForecastSource {
  readonly name = "open_meteo";
  // fetch is injected for testability (defaults to the global).
  private readonly fetchImpl: typeof fetch;

  constructor(fetchImpl: typeof fetch = fetch) {
    this.fetchImpl = fetchImpl;
  }

  async fetchHourly(lat: number, lng: number, days: number): Promise<HourlyForecast[]> {
    const params = new URLSearchParams({
      latitude: String(lat),
      longitude: String(lng),
      hourly: [
        "temperature_2m",
        "wind_speed_10m",
        "wind_gusts_10m",
        "wind_direction_10m",
        "precipitation",
        "cloud_cover",
      ].join(","),
      wind_speed_unit: "ms",
      timezone: "GMT",
      forecast_days: String(days),
    });

    const response = await this.fetchImpl(`${OPEN_METEO_BASE}?${params.toString()}`);
    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(`Open-Meteo returned ${response.status}: ${body}`);
    }

    const data = (await response.json()) as OpenMeteoResponse;
    return this.normalize(data);
  }

  supportsRegion(_countryCode: string): boolean {
    // Open-Meteo has global coverage. Regional model selection (e.g. KNMI for NL)
    // is automatic based on lat/lng.
    return true;
  }

  private normalize(data: OpenMeteoResponse): HourlyForecast[] {
    const h = data.hourly;
    return h.time.map((t, i) => ({
      // Open-Meteo returns GMT times without a "Z" suffix ("2026-04-23T12:00").
      // Append Z so consumers parse it as UTC.
      time: `${t}Z`,
      windSpeedMs: h.wind_speed_10m[i] ?? 0,
      gustMs: h.wind_gusts_10m[i] ?? 0,
      windDirectionDeg: h.wind_direction_10m[i] ?? 0,
      airTempC: h.temperature_2m[i] ?? 0,
      waterTempC: null, // Open-Meteo forecast endpoint doesn't provide this.
      precipitationMm: h.precipitation[i] ?? 0,
      cloudCoveragePct: h.cloud_cover[i] ?? 0,
    }));
  }
}
