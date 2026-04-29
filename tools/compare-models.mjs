// Compare wind forecasts across the major Open-Meteo models for an NL
// kite spot. Prints a side-by-side table for the next 24h so you can
// eyeball which model lines up with what Windguru's default "WG"
// forecast shows.
//
// Run from repo root:
//   node tools/compare-models.mjs
//
// No API key required — Open-Meteo free public endpoint.

const SPOT = {
  name: "Wijk aan Zee — Noordpier",
  lat: 52.4928,
  lng: 4.6037,
};

// Models we have access to via Open-Meteo's /v1/forecast endpoint.
// `best_match` is the blended default; the rest let us see how each
// model behaves individually so we can pick the one that aligns with
// Windguru's WG number (which is likely GFS-flavoured).
const MODELS = [
  { id: "best_match", label: "Best match (Open-Meteo blend)" },
  { id: "knmi_harmonie_arome_netherlands", label: "HARMONIE NL 2km (current)" },
  { id: "ecmwf_ifs04", label: "ECMWF IFS 9km" },
  { id: "gfs_seamless", label: "GFS 13km" },
  { id: "icon_seamless", label: "ICON 13km" },
  { id: "meteofrance_arome_france", label: "AROME France 1.3km" },
];

const HOURS_TO_SHOW = 24;

async function fetchModel(modelId) {
  const params = new URLSearchParams({
    latitude: String(SPOT.lat),
    longitude: String(SPOT.lng),
    hourly: "wind_speed_10m,wind_gusts_10m,wind_direction_10m",
    models: modelId,
    wind_speed_unit: "kn",
    timezone: "Europe/Amsterdam",
    forecast_days: "2",
  });
  const url = `https://api.open-meteo.com/v1/forecast?${params.toString()}`;
  const res = await fetch(url);
  if (!res.ok) {
    return { id: modelId, error: `HTTP ${res.status}` };
  }
  const data = await res.json();
  return { id: modelId, data };
}

function compass(deg) {
  const dirs = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE",
                "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];
  return dirs[Math.round(((deg % 360) / 22.5)) % 16];
}

async function main() {
  console.log(`\n=== Wind forecast comparison · ${SPOT.name} ===\n`);

  const results = await Promise.all(MODELS.map((m) => fetchModel(m.id)));
  const successful = results.filter((r) => !r.error && r.data?.hourly?.time);

  if (successful.length === 0) {
    console.error("All model calls failed.");
    return;
  }

  // Find the first hour from "now" so all rows align.
  const firstModel = successful[0].data;
  const nowIso = new Date().toISOString().slice(0, 13); // "YYYY-MM-DDTHH"
  let startIdx = firstModel.hourly.time.findIndex((t) => t >= nowIso);
  if (startIdx < 0) startIdx = 0;
  const endIdx = Math.min(startIdx + HOURS_TO_SHOW, firstModel.hourly.time.length);

  // Header — time row.
  const times = firstModel.hourly.time.slice(startIdx, endIdx);
  const timeLabels = times.map((t) => t.slice(11, 16));
  process.stdout.write("Model".padEnd(34));
  for (const t of timeLabels) process.stdout.write(t.padStart(6));
  process.stdout.write("\n");
  process.stdout.write("─".repeat(34 + 6 * timeLabels.length) + "\n");

  // One row per model (wind speed in knots).
  for (const m of MODELS) {
    const r = results.find((x) => x.id === m.id);
    if (r.error) {
      console.log(`${m.label.padEnd(34)}  ${r.error}`);
      continue;
    }
    const row = m.label.padEnd(34);
    process.stdout.write(row);
    for (let i = startIdx; i < endIdx; i++) {
      const v = r.data.hourly.wind_speed_10m[i];
      process.stdout.write(
        (v === null || v === undefined ? "—" : v.toFixed(0)).padStart(6),
      );
    }
    process.stdout.write("\n");
  }

  // Summary: mean wind across daylight hours (08–20 local).
  console.log("\n--- Daylight averages (08:00 → 20:00) ---");
  for (const m of MODELS) {
    const r = results.find((x) => x.id === m.id);
    if (r.error) continue;
    const winds = [];
    const gusts = [];
    for (let i = 0; i < r.data.hourly.time.length; i++) {
      const hour = parseInt(r.data.hourly.time[i].slice(11, 13), 10);
      if (hour >= 8 && hour <= 20) {
        const w = r.data.hourly.wind_speed_10m[i];
        const g = r.data.hourly.wind_gusts_10m[i];
        if (w != null) winds.push(w);
        if (g != null) gusts.push(g);
      }
      // Only first day's daylight.
      if (i > 0 && r.data.hourly.time[i].slice(0, 10) !== r.data.hourly.time[0].slice(0, 10)) break;
    }
    const meanW = winds.reduce((a, b) => a + b, 0) / Math.max(1, winds.length);
    const peakG = gusts.length ? Math.max(...gusts) : 0;
    console.log(
      `  ${m.label.padEnd(34)}  mean wind ${meanW.toFixed(1)} kn · peak gust ${peakG.toFixed(0)} kn`,
    );
  }

  // Also dump direction at midday so we can sanity-check coherence.
  console.log("\n--- Direction at 12:00 today ---");
  for (const m of MODELS) {
    const r = results.find((x) => x.id === m.id);
    if (r.error) continue;
    const idx = r.data.hourly.time.findIndex((t) => t.endsWith("12:00"));
    if (idx < 0) continue;
    const dir = r.data.hourly.wind_direction_10m[idx];
    const w = r.data.hourly.wind_speed_10m[idx];
    console.log(
      `  ${m.label.padEnd(34)}  ${w?.toFixed(0)} kn from ${compass(dir)} (${Math.round(dir)}°)`,
    );
  }

  console.log(
    `\n→ Pick the row whose numbers match the Windguru "WG" default forecast you screenshotted.`,
  );
  console.log(`  Then tell me which model and I'll wire it up as the primary.\n`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
