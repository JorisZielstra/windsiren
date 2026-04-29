// One-off sanity check for the KNMI HARMONIE-AROME swap. Calls Open-
// Meteo's public free endpoint for two NL spots and prints the next
// 24h of wind / gust / direction so you can spot-check that the new
// model is returning sensible numbers (and that gust is meaningfully
// above mean wind, which has been the OpenWeather complaint).
//
// Run from repo root:
//   node tools/verify-knmi.mjs
//
// No API key required — this is the free public endpoint.

const SPOTS = [
  { name: "Wijk aan Zee — Noordpier", lat: 52.4928, lng: 4.6037 },
  { name: "Scheveningen", lat: 52.1083, lng: 4.2735 },
];

const HOURLY_FIELDS = [
  "temperature_2m",
  "wind_speed_10m",
  "wind_gusts_10m",
  "wind_direction_10m",
  "precipitation",
  "cloud_cover",
];

async function fetchKnmi(lat, lng) {
  const params = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lng),
    hourly: HOURLY_FIELDS.join(","),
    models: "knmi_harmonie_arome_netherlands",
    wind_speed_unit: "kn",
    timezone: "Europe/Amsterdam",
    forecast_days: "3",
  });
  const url = `https://api.open-meteo.com/v1/forecast?${params.toString()}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${await res.text()}`);
  }
  return res.json();
}

function compass(deg) {
  const dirs = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE",
                "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];
  return dirs[Math.round(((deg % 360) / 22.5)) % 16];
}

async function main() {
  for (const spot of SPOTS) {
    console.log(`\n=== ${spot.name} (${spot.lat}, ${spot.lng}) ===`);
    let data;
    try {
      data = await fetchKnmi(spot.lat, spot.lng);
    } catch (err) {
      console.error(`  Failed: ${err.message}`);
      continue;
    }
    const h = data.hourly;
    if (!h?.time?.length) {
      console.log("  No data returned (coords outside model coverage?)");
      continue;
    }
    console.log(
      `  Next 24h — KNMI HARMONIE-AROME, units ${data.hourly_units.wind_speed_10m}`,
    );
    console.log(
      `  ${"Time".padEnd(6)} ${"Wind".padStart(6)} ${"Gust".padStart(6)} ${"Dir".padStart(7)} ${"Air".padStart(6)} ${"Rain".padStart(6)}`,
    );
    const limit = Math.min(24, h.time.length);
    for (let i = 0; i < limit; i++) {
      const time = h.time[i].slice(11, 16);
      const wind = h.wind_speed_10m[i].toFixed(1);
      const gust = h.wind_gusts_10m[i].toFixed(1);
      const dir = `${Math.round(h.wind_direction_10m[i])}° ${compass(h.wind_direction_10m[i])}`;
      const air = `${h.temperature_2m[i].toFixed(1)}°`;
      const rain = h.precipitation[i].toFixed(1);
      console.log(
        `  ${time.padEnd(6)} ${wind.padStart(6)} ${gust.padStart(6)} ${dir.padStart(7)} ${air.padStart(6)} ${rain.padStart(6)}`,
      );
    }
    const peakGust = Math.max(...h.wind_gusts_10m.slice(0, limit));
    const meanWind =
      h.wind_speed_10m.slice(0, limit).reduce((a, b) => a + b, 0) / limit;
    console.log(
      `  → peak gust next 24h: ${peakGust.toFixed(1)} kn · mean wind: ${meanWind.toFixed(1)} kn`,
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
