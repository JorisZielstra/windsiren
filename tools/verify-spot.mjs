// Diagnose why a specific spot returns "Forecast unavailable". Hits
// every Open-Meteo model we use, prints the HTTP status + first hour
// of returned data so you can see exactly which one is failing for
// the given coordinates.
//
// Run from repo root with a slug:
//   node tools/verify-spot.mjs waddenzee-texel
// Or with raw lat/lng:
//   node tools/verify-spot.mjs 53.167 4.875 'Waddenzee Texel'

const KNOWN = {
  "wijk-aan-zee-noordpier": { lat: 52.4928, lng: 4.6037, name: "Wijk aan Zee Noordpier" },
  "waddenzee-texel": { lat: 53.167006, lng: 4.874932, name: "Waddenzee Texel" },
  "paal-17-texel": { lat: 53.081422, lng: 4.736081, name: "Paal 17 Texel" },
  "scheveningen": { lat: 52.1083, lng: 4.2735, name: "Scheveningen" },
  "brouwersdam": { lat: 51.7556, lng: 3.85, name: "Brouwersdam" },
  "workum": { lat: 52.96778, lng: 5.41137, name: "Workum" },
};

const MODELS = [
  { id: "best_match",                    label: "best_match (current splice fallback)" },
  { id: "knmi_harmonie_arome_netherlands", label: "KNMI HARMONIE NL 2km (current splice primary)" },
  { id: "knmi_harmonie_arome_europe",      label: "KNMI HARMONIE EU 5.5km (NL fallback)" },
  { id: "ecmwf_ifs04",                   label: "ECMWF IFS 9km (long-range backup)" },
  { id: "gfs_seamless",                  label: "GFS 13km" },
];

function parseArgs() {
  const a = process.argv.slice(2);
  if (a.length === 1) {
    const slug = a[0];
    if (!KNOWN[slug]) {
      console.error(`Unknown slug "${slug}". Known: ${Object.keys(KNOWN).join(", ")}`);
      process.exit(2);
    }
    return KNOWN[slug];
  }
  if (a.length >= 2) {
    return { lat: Number(a[0]), lng: Number(a[1]), name: a[2] || `${a[0]},${a[1]}` };
  }
  console.error("Usage: node tools/verify-spot.mjs <slug>  OR  node tools/verify-spot.mjs <lat> <lng> [name]");
  process.exit(2);
}

async function probe(spot, modelId) {
  const params = new URLSearchParams({
    latitude: String(spot.lat),
    longitude: String(spot.lng),
    hourly: "wind_speed_10m,wind_gusts_10m,wind_direction_10m",
    models: modelId,
    wind_speed_unit: "kn",
    timezone: "Europe/Amsterdam",
    forecast_days: "2",
  });
  const url = `https://api.open-meteo.com/v1/forecast?${params.toString()}`;
  const t0 = Date.now();
  try {
    const res = await fetch(url);
    const elapsed = Date.now() - t0;
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return { ok: false, status: res.status, elapsed, body: body.slice(0, 160) };
    }
    const data = await res.json();
    const t = data?.hourly?.time?.length ?? 0;
    const firstWind = data?.hourly?.wind_speed_10m?.[0];
    return { ok: true, elapsed, hours: t, firstWind, firstTime: data?.hourly?.time?.[0] };
  } catch (err) {
    return { ok: false, status: "network", elapsed: Date.now() - t0, body: String(err) };
  }
}

async function main() {
  const spot = parseArgs();
  console.log(`\n=== ${spot.name}  (lat ${spot.lat}, lng ${spot.lng}) ===\n`);

  for (const m of MODELS) {
    const r = await probe(spot, m.id);
    if (r.ok) {
      console.log(
        `  ✓ ${m.label.padEnd(54)} ${r.hours.toString().padStart(3)} hrs · first ${r.firstWind?.toFixed(0)} kn @ ${r.firstTime?.slice(11, 16)} (${r.elapsed}ms)`,
      );
    } else {
      console.log(
        `  ✗ ${m.label.padEnd(54)} status ${r.status} (${r.elapsed}ms)${r.body ? " — " + r.body.replace(/\s+/g, " ") : ""}`,
      );
    }
  }

  console.log("\nDiagnosis:");
  console.log("  - All ✓        → app code bug (likely cache poisoning). Restart dev server.");
  console.log("  - best_match ✗ → Open-Meteo issue. Try again in a minute.");
  console.log("  - HARMONIE NL ✗ + best_match ✓ → coord outside HARMONIE domain (expected for far-north Wadden), should auto-fallback.");
  console.log("  - All 429      → free-tier rate limit. Wait 60s, restart.\n");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
