import type { ForecastSource, HourlyForecast } from "@windsiren/shared";
import {
  blendForecasts,
  MODEL_HORIZON_DAYS,
  modelsForSpot,
  type ModelStream,
} from "./blend";
import { TtlCache } from "./cache";

// Open-Meteo provider, per-region blended.
//
// Architecture (validated 2026-04-29 against Windguru WG):
//   1. Classify the spot's coordinate into a zone (A/B/C/D).
//   2. Fetch every model in that zone's recipe in parallel from the
//      same /v1/forecast endpoint, capped at each model's horizon.
//   3. Blend per timestamp: drop direction outliers, mean wind speed,
//      max gust (with AROME-FR cap), vector-mean direction.
//   4. For long-range hours past every recipe model's horizon, the
//      blend naturally falls through to whichever globals (GFS,
//      ECMWF AIFS) still cover that hour — no separate fallback fetch.
//
// Replaces the previous KNMI HARMONIE splice. WEATHER_MODEL env var
// still works as a debug escape hatch — when set, the provider runs
// single-model with no blend.
const FORECAST_BASE = "https://api.open-meteo.com/v1/forecast";

const HOURLY_FIELDS = [
  "temperature_2m",
  "wind_speed_10m",
  "wind_gusts_10m",
  "wind_direction_10m",
  "precipitation",
  "cloud_cover",
] as const;

type OpenMeteoResponse = {
  hourly?: {
    time: string[];
    temperature_2m: number[];
    wind_speed_10m: number[];
    wind_gusts_10m: number[];
    wind_direction_10m: number[];
    precipitation: number[];
    cloud_cover: number[];
  };
};

const CACHE_TTL_MS = 30 * 60 * 1000; // 30 min — most models update hourly
const REQUEST_TIMEOUT_MS = 5_000;
const MAX_RETRIES = 2;
const RETRY_BACKOFF_BASE_MS = 100;

// Debug escape hatch: if WEATHER_MODEL is set we skip the blend and
// run single-model. Useful for "force best_match" while diagnosing,
// or for swapping to Open-Meteo's commercial endpoint later.
function singleModelOverride(): string | null {
  if (typeof process !== "undefined" && process.env) {
    return (
      process.env.WEATHER_MODEL ||
      process.env.EXPO_PUBLIC_WEATHER_MODEL ||
      null
    );
  }
  return null;
}

export class OpenMeteoForecastSource implements ForecastSource {
  readonly name = "open_meteo";
  private readonly fetchImpl: typeof fetch;
  private readonly cache: TtlCache<HourlyForecast[]>;

  constructor(fetchImpl: typeof fetch = fetch) {
    this.fetchImpl = fetchImpl;
    this.cache = new TtlCache<HourlyForecast[]>(CACHE_TTL_MS);
  }

  async fetchHourly(
    lat: number,
    lng: number,
    days: number,
  ): Promise<HourlyForecast[]> {
    const override = singleModelOverride();
    const recipe = override ? [override] : modelsForSpot(lat, lng);
    const cacheKey = `${recipe.join(",")}|${lat}|${lng}|${days}`;
    const cached = this.cache.get(cacheKey);
    if (cached) return cached;

    // Fetch every model in parallel, each capped at its own horizon
    // so we don't ask AROME-FR for 16 days and trigger a 4xx.
    const streams: ModelStream[] = await Promise.all(
      recipe.map(async (modelId) => {
        const horizonCap = MODEL_HORIZON_DAYS[modelId] ?? days;
        const cappedDays = Math.min(days, horizonCap);
        const hours = await this.fetchModel(lat, lng, cappedDays, modelId).catch(
          () => [] as HourlyForecast[],
        );
        return { modelId, hours };
      }),
    );

    const blended = override ? streams[0]!.hours : blendForecasts(streams);

    // Only cache non-empty results — an empty array means everyone
    // missed (transient: rate limit, network blip), so don't lock the
    // user into "Forecast unavailable" for the next 30 minutes.
    if (blended.length > 0) {
      this.cache.set(cacheKey, blended);
    }
    return blended;
  }

  supportsRegion(_countryCode: string): boolean {
    return true;
  }

  private async fetchModel(
    lat: number,
    lng: number,
    days: number,
    modelId: string,
  ): Promise<HourlyForecast[]> {
    const params = new URLSearchParams({
      latitude: String(lat),
      longitude: String(lng),
      hourly: HOURLY_FIELDS.join(","),
      models: modelId,
      wind_speed_unit: "ms",
      timezone: "GMT",
      forecast_days: String(days),
    });
    const data = await this.requestJson(
      `${FORECAST_BASE}?${params.toString()}`,
    );
    return data ? normalize(data) : [];
  }

  // 5s timeout per attempt, retry on 5xx and 429, exponential backoff,
  // null on permanent failure (4xx other than 429). The blend layer
  // treats null/empty streams as "this model had nothing here, skip it."
  private async requestJson(url: string): Promise<OpenMeteoResponse | null> {
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
        try {
          const response = await this.fetchImpl(url, {
            signal: controller.signal,
          });
          // 429 = rate limited. The dashboard fans out 50+ parallel
          // calls after the all-NL seed migration, which trips the
          // free-tier soft limit. Retry with backoff.
          if (response.status === 429) {
            throw new Error("Open-Meteo 429");
          }
          if (response.status >= 400 && response.status < 500) {
            // Other 4xx — typically "model doesn't cover this lat/lng".
            // Permanent for this URL; the blend handles it gracefully.
            return null;
          }
          if (!response.ok) {
            throw new Error(`Open-Meteo ${response.status}`);
          }
          return (await response.json()) as OpenMeteoResponse;
        } finally {
          clearTimeout(timer);
        }
      } catch {
        if (attempt === MAX_RETRIES) return null;
        await sleep(RETRY_BACKOFF_BASE_MS * 4 ** attempt);
      }
    }
    return null;
  }
}

function normalize(data: OpenMeteoResponse): HourlyForecast[] {
  const h = data.hourly;
  if (!h || !h.time || h.time.length === 0) return [];
  const out: HourlyForecast[] = [];
  for (let i = 0; i < h.time.length; i++) {
    // Some models return null entries within the array for hours past
    // their horizon (rather than truncating). Skip those — letting
    // them through would feed 0s into the blend mean and pull averages
    // toward zero.
    const w = h.wind_speed_10m[i];
    if (w == null) continue;
    out.push({
      time: `${h.time[i]}Z`,
      windSpeedMs: w,
      gustMs: h.wind_gusts_10m[i] ?? 0,
      windDirectionDeg: h.wind_direction_10m[i] ?? 0,
      airTempC: h.temperature_2m[i] ?? 0,
      waterTempC: null,
      precipitationMm: h.precipitation[i] ?? 0,
      cloudCoveragePct: h.cloud_cover[i] ?? 0,
    });
  }
  return out;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
