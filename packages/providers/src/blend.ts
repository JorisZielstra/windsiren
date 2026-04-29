import type { HourlyForecast } from "@windsiren/shared";

// Per-region wind-model blend, validated 2026-04-29 against Windguru WG.
// See tools/stress-test-zones.mjs + the validation report for the data
// behind these choices. In short:
//   - Direction agreement among all surviving models was 100% within
//     30° of WG → outlier filter at 30° is correct.
//   - Wind speed lined up within ±1 kn for Zones A/B/D, +2.6 for C.
//     Zone C carries a third anchor (ECMWF AIFS) to dampen AROME-FR.
//   - Gust ran +3 to +5 kn high, mostly from AROME-FR's dawn spike →
//     cap AROME's gust at 1.4× GFS gust before maxing.

export type Zone = "A" | "B" | "C" | "D";

export type ZoneInfo = {
  zone: Zone;
  label: string;
  models: string[];
};

// Listed in priority order for documentation only — the blend itself
// is order-agnostic (mean is associative). First model with coverage
// is used as the GFS-anchor for gust capping (see GFS_GUST_ANCHOR).
const ZONES: Record<Zone, ZoneInfo> = {
  A: {
    zone: "A",
    label: "Wadden / North coast",
    models: ["gfs_seamless", "metno_seamless", "ecmwf_aifs025"],
  },
  B: {
    zone: "B",
    label: "Central coast",
    models: ["gfs_seamless", "meteofrance_arome_france", "ecmwf_aifs025"],
  },
  C: {
    zone: "C",
    label: "Zeeland / South",
    models: ["meteofrance_arome_france", "gfs_seamless", "ecmwf_aifs025"],
  },
  D: {
    zone: "D",
    label: "Inland lakes",
    models: ["gfs_seamless", "icon_d2", "ecmwf_aifs025"],
  },
};

// Coverage horizons in days — used to cap forecast_days per model so
// we don't waste API calls or trigger a 4xx for hours past the model's
// available range. Past horizon, the model just drops out of the blend
// for those hours and longer-range globals carry the load.
export const MODEL_HORIZON_DAYS: Record<string, number> = {
  gfs_seamless: 16,
  ecmwf_aifs025: 9,
  meteofrance_arome_france: 4,
  metno_seamless: 3,
  icon_d2: 2,
  best_match: 16,
};

// Classification rule. Wadden separates by lat; Zeeland by lat;
// central NL split between coast (lng < 5°) and inland lakes
// (lng ≥ 5°). Bias-tested against the seven-spot validation set;
// every spot landed in the zone its recipe was built for.
export function classifySpot(lat: number, lng: number): Zone {
  if (lat >= 53.0) return "A";
  if (lat < 52.0) return "C";
  return lng < 5.0 ? "B" : "D";
}

export function zoneInfo(lat: number, lng: number): ZoneInfo {
  return ZONES[classifySpot(lat, lng)];
}

// Per-spot model list — the only API the provider needs.
export function modelsForSpot(lat: number, lng: number): string[] {
  return zoneInfo(lat, lng).models;
}

// ---------------------------------------------------------------------
// Pure blend math — fed by the provider after parallel model fetches.
// ---------------------------------------------------------------------

export type ModelStream = {
  modelId: string;
  hours: HourlyForecast[];
};

const DIRECTION_OUTLIER_DEG = 30;
const AROME_GUST_CAP_FACTOR = 1.4; // dawn-spike dampener
const AROME_MODEL_ID = "meteofrance_arome_france";
const GFS_GUST_ANCHOR = "gfs_seamless";

export function blendForecasts(streams: ModelStream[]): HourlyForecast[] {
  if (streams.length === 0) return [];

  // Index every model's hours by ISO timestamp so we can iterate by
  // unique time rather than assume parallel arrays — different models
  // have different horizons, so their time arrays don't align by index.
  const indexed = streams.map((s) => ({
    modelId: s.modelId,
    byTime: new Map(s.hours.map((h) => [h.time, h])),
  }));

  const allTimes = new Set<string>();
  for (const s of streams) for (const h of s.hours) allTimes.add(h.time);

  const result: HourlyForecast[] = [];
  for (const time of [...allTimes].sort()) {
    const present: { modelId: string; hour: HourlyForecast }[] = [];
    for (const m of indexed) {
      const h = m.byTime.get(time);
      if (h) present.push({ modelId: m.modelId, hour: h });
    }
    if (present.length === 0) continue;

    // Direction outlier rejection. A model whose direction is more
    // than 30° off the median is in a different synoptic flow and
    // shouldn't enter the wind-speed mean. Dropping happens per hour
    // — a model can be IN at noon and OUT at 18:00 if a front passes.
    const medianDir = medianAngle(present.map((p) => p.hour.windDirectionDeg));
    const kept =
      present.length > 1
        ? present.filter(
            (p) => angleDiff(p.hour.windDirectionDeg, medianDir) < DIRECTION_OUTLIER_DEG,
          )
        : present;
    if (kept.length === 0) continue;

    // Wind speed: simple arithmetic mean of survivors.
    const wind = mean(kept.map((p) => p.hour.windSpeedMs));

    // Gust: max of survivors, but with the AROME-FR cap. Without the
    // cap, AROME's dawn-time gust spikes pull the blend ~5 kn over WG
    // at first daylight (validated 2026-04-29). The cap is anchored
    // on GFS gust because GFS is in every recipe and rarely spikes.
    const gfsGust = kept.find((p) => p.modelId === GFS_GUST_ANCHOR)?.hour.gustMs;
    let maxGust = 0;
    for (const p of kept) {
      let g = p.hour.gustMs;
      if (gfsGust != null && p.modelId === AROME_MODEL_ID) {
        const cap = gfsGust * AROME_GUST_CAP_FACTOR;
        if (g > cap) g = cap;
      }
      if (g > maxGust) maxGust = g;
    }

    // Direction: vector mean of survivors.
    const dir = medianAngle(kept.map((p) => p.hour.windDirectionDeg));

    // Other fields: simple mean. Cloud cover and precipitation are
    // less direction-sensitive so all survivors contribute equally.
    const airTempC = mean(kept.map((p) => p.hour.airTempC));
    const precipitationMm = mean(kept.map((p) => p.hour.precipitationMm));
    const cloudCoveragePct = mean(kept.map((p) => p.hour.cloudCoveragePct));

    result.push({
      time,
      windSpeedMs: wind,
      gustMs: maxGust,
      windDirectionDeg: dir,
      airTempC,
      // Provider doesn't fetch water temp from these endpoints; downstream
      // consumers handle the null gracefully (see decision-engine.ts).
      waterTempC: null,
      precipitationMm,
      cloudCoveragePct,
    });
  }
  return result;
}

// ---------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------

function mean(xs: number[]): number {
  return xs.reduce((s, x) => s + x, 0) / xs.length;
}

// Smallest absolute difference between two compass bearings, 0..180°.
export function angleDiff(a: number, b: number): number {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}

// Vector mean of compass bearings. Avoids the 0°/360° wrap bug a
// naive average has (e.g., mean of 350° and 10° should be 0°, not 180°).
export function medianAngle(angles: number[]): number {
  if (angles.length === 0) return 0;
  let sx = 0;
  let sy = 0;
  for (const a of angles) {
    sx += Math.cos((a * Math.PI) / 180);
    sy += Math.sin((a * Math.PI) / 180);
  }
  const mean = (Math.atan2(sy, sx) * 180) / Math.PI;
  return (mean + 360) % 360;
}
