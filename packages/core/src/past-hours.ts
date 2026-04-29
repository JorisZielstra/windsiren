import type { HourlyForecast, Spot } from "@windsiren/shared";

// Fetches the past N hours of hourly wind for a spot. The "Live history"
// modal in the spot detail page reads this — it answers "what did the
// wind actually do over the last few hours?".
//
// Uses Open-Meteo's blended best_match endpoint with `past_days` set,
// which reanalyzes past hours against observations so the values are
// closer to what stations actually recorded than a pure forecast model.
// Aligning with the rest of the app's per-region blend would require
// fetching multiple models for past hours and applying the same blend
// math — possible follow-up, but for now best_match alone is fine for
// "live history" since accuracy matters less here than for the forward
// forecast (we're showing what already happened, not betting on it).
export async function fetchPastHours(
  spot: Pick<Spot, "lat" | "lng">,
  hoursBack: number = 24,
  fetchImpl: typeof fetch = fetch,
): Promise<HourlyForecast[]> {
  const pastDays = Math.max(1, Math.ceil(hoursBack / 24));
  const params = new URLSearchParams({
    latitude: String(spot.lat),
    longitude: String(spot.lng),
    hourly: [
      "temperature_2m",
      "wind_speed_10m",
      "wind_gusts_10m",
      "wind_direction_10m",
    ].join(","),
    wind_speed_unit: "ms",
    timezone: "GMT",
    past_days: String(pastDays),
    forecast_days: "1",
  });

  const response = await fetchImpl(
    `https://api.open-meteo.com/v1/forecast?${params.toString()}`,
  );
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`Open-Meteo returned ${response.status}: ${body}`);
  }
  const data = (await response.json()) as {
    hourly: {
      time: string[];
      temperature_2m: number[];
      wind_speed_10m: number[];
      wind_gusts_10m: number[];
      wind_direction_10m: number[];
    };
  };
  return parseAndFilter(data, hoursBack);
}

function parseAndFilter(
  data: {
    hourly?: {
      time?: string[];
      temperature_2m?: number[];
      wind_speed_10m?: number[];
      wind_gusts_10m?: number[];
      wind_direction_10m?: number[];
    };
  },
  hoursBack: number,
): HourlyForecast[] {
  const h = data.hourly;
  if (!h?.time) return [];
  const cutoff = Date.now() - hoursBack * 3600 * 1000;
  const now = Date.now();
  const out: HourlyForecast[] = [];
  for (let i = 0; i < h.time.length; i++) {
    const ts = new Date(`${h.time[i]}Z`).getTime();
    if (ts < cutoff || ts > now) continue;
    out.push({
      time: `${h.time[i]}Z`,
      windSpeedMs: h.wind_speed_10m?.[i] ?? 0,
      gustMs: h.wind_gusts_10m?.[i] ?? 0,
      windDirectionDeg: h.wind_direction_10m?.[i] ?? 0,
      airTempC: h.temperature_2m?.[i] ?? 0,
      waterTempC: null,
      precipitationMm: 0,
      cloudCoveragePct: 0,
    });
  }
  return out;
}
