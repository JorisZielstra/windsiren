// Sanity-check the per-zone blend output against Windguru WG manually.
// Prints the next 24h of the actual production blend for one or more
// spots — what the app will display for that lat/lng. Useful when
// re-tuning a zone recipe: change the recipe in blend.ts, run this,
// open Windguru in another tab, eyeball the gap.
//
// Run from repo root:
//   node tools/verify-blend.mjs                        (all 4 zones, default spots)
//   node tools/verify-blend.mjs wijk-aan-zee-noordpier (single spot)
//   node tools/verify-blend.mjs 52.49 4.60 'Custom'    (raw lat/lng)

const SPOTS_BY_ZONE = {
  A: { name: "Waddenzee Texel", lat: 53.167, lng: 4.875, windguru: "https://www.windguru.cz/1398" },
  B: { name: "Wijk aan Zee", lat: 52.4928, lng: 4.6037, windguru: "https://www.windguru.cz/113" },
  C: { name: "Brouwersdam", lat: 51.7556, lng: 3.85, windguru: "https://www.windguru.cz/80" },
  D: { name: "Workum", lat: 52.9678, lng: 5.4114, windguru: "https://www.windguru.cz/1395" },
};

// Mirror of packages/providers/src/blend.ts. Kept inline so this script
// can run as a standalone .mjs without a TypeScript build step. If you
// change the recipes there, change them here too.
const ZONE_RECIPES = {
  A: ["gfs_seamless", "metno_seamless", "ecmwf_aifs025"],
  B: ["gfs_seamless", "meteofrance_arome_france", "ecmwf_aifs025"],
  C: ["meteofrance_arome_france", "gfs_seamless", "ecmwf_aifs025"],
  D: ["gfs_seamless", "icon_d2", "ecmwf_aifs025"],
};

const MODEL_HORIZON_DAYS = {
  gfs_seamless: 16,
  ecmwf_aifs025: 9,
  meteofrance_arome_france: 4,
  metno_seamless: 3,
  icon_d2: 2,
};

function classify(lat, lng) {
  if (lat >= 53.0) return "A";
  if (lat < 52.0) return "C";
  return lng < 5.0 ? "B" : "D";
}

async function fetchModel(spot, modelId, days) {
  const cap = Math.min(days, MODEL_HORIZON_DAYS[modelId] ?? days);
  const params = new URLSearchParams({
    latitude: String(spot.lat),
    longitude: String(spot.lng),
    hourly: "wind_speed_10m,wind_gusts_10m,wind_direction_10m",
    models: modelId,
    wind_speed_unit: "kn",
    timezone: "Europe/Amsterdam",
    forecast_days: String(cap),
  });
  try {
    const res = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`);
    if (!res.ok) return { modelId, ok: false, status: res.status };
    const data = await res.json();
    if (!data?.hourly?.time?.length) return { modelId, ok: false, status: "empty" };
    const byTime = new Map();
    for (let i = 0; i < data.hourly.time.length; i++) {
      const t = data.hourly.time[i];
      const w = data.hourly.wind_speed_10m[i];
      if (w == null) continue;
      byTime.set(t, {
        wind: w,
        gust: data.hourly.wind_gusts_10m[i] ?? 0,
        dir: data.hourly.wind_direction_10m[i] ?? 0,
      });
    }
    return { modelId, ok: true, byTime };
  } catch (err) {
    return { modelId, ok: false, status: String(err) };
  }
}

function angleDiff(a, b) {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}

function vectorMean(angles) {
  let sx = 0, sy = 0;
  for (const a of angles) {
    sx += Math.cos((a * Math.PI) / 180);
    sy += Math.sin((a * Math.PI) / 180);
  }
  return ((Math.atan2(sy, sx) * 180) / Math.PI + 360) % 360;
}

function compass(deg) {
  const dirs = ["N","NNE","NE","ENE","E","ESE","SE","SSE","S","SSW","SW","WSW","W","WNW","NW","NNW"];
  return dirs[Math.round(((deg % 360) / 22.5)) % 16];
}

// Replicates blend.ts blendForecasts logic so the script reflects what
// the app will actually render. Updates here must mirror the TS module.
function blend(streams) {
  const indexed = streams.filter((s) => s.ok).map((s) => ({ modelId: s.modelId, byTime: s.byTime }));
  if (indexed.length === 0) return [];

  const allTimes = new Set();
  for (const m of indexed) for (const t of m.byTime.keys()) allTimes.add(t);

  const out = [];
  for (const time of [...allTimes].sort()) {
    const present = [];
    for (const m of indexed) {
      const h = m.byTime.get(time);
      if (h) present.push({ modelId: m.modelId, ...h });
    }
    if (present.length === 0) continue;

    const medianDir = vectorMean(present.map((p) => p.dir));
    const kept = present.length > 1
      ? present.filter((p) => angleDiff(p.dir, medianDir) < 30)
      : present;
    if (kept.length === 0) continue;

    const wind = kept.reduce((a, b) => a + b.wind, 0) / kept.length;
    const gfsGust = kept.find((p) => p.modelId === "gfs_seamless")?.gust;
    let maxGust = 0;
    for (const p of kept) {
      let g = p.gust;
      if (gfsGust != null && p.modelId === "meteofrance_arome_france") {
        const cap = gfsGust * 1.4;
        if (g > cap) g = cap;
      }
      if (g > maxGust) maxGust = g;
    }
    out.push({
      time,
      wind,
      gust: maxGust,
      dir: vectorMean(kept.map((p) => p.dir)),
      contributors: kept.map((p) => p.modelId),
      droppedDir: present.length - kept.length,
    });
  }
  return out;
}

async function processSpot(spot) {
  const zone = classify(spot.lat, spot.lng);
  const recipe = ZONE_RECIPES[zone];
  console.log(`\n── ${spot.name}  (Zone ${zone}, ${spot.lat}, ${spot.lng})`);
  if (spot.windguru) console.log(`   Windguru: ${spot.windguru}`);
  console.log(`   Recipe: ${recipe.join(" + ")}`);

  const streams = await Promise.all(recipe.map((m) => fetchModel(spot, m, 2)));
  for (const s of streams) {
    if (!s.ok) console.log(`   ⚠ ${s.modelId}: ${s.status}`);
  }
  const blended = blend(streams);
  if (blended.length === 0) {
    console.log("   No blend output. Bailing.");
    return;
  }

  const now = new Date().toISOString().slice(0, 13);
  const startIdx = blended.findIndex((h) => h.time >= now);
  const slice = blended.slice(Math.max(0, startIdx), Math.max(0, startIdx) + 24);

  console.log("");
  console.log("   Time    Wind  Gust  Dir   Contributors");
  console.log("   ─────   ────  ────  ───   ──────────────────────");
  for (const h of slice) {
    const time = h.time.slice(11, 16);
    const wind = h.wind.toFixed(0).padStart(4);
    const gust = h.gust.toFixed(0).padStart(4);
    const dir = `${Math.round(h.dir)}°`.padEnd(4);
    const contribs = h.contributors.map(shortName).join("+");
    const note = h.droppedDir > 0 ? ` (−${h.droppedDir}dir)` : "";
    console.log(`   ${time}   ${wind}  ${gust}  ${dir}  ${contribs}${note}`);
  }

  // Daylight summary
  const dayHours = slice.filter((h) => {
    const hr = parseInt(h.time.slice(11, 13), 10);
    return hr >= 8 && hr <= 20;
  });
  if (dayHours.length) {
    const meanWind = dayHours.reduce((a, b) => a + b.wind, 0) / dayHours.length;
    const peakGust = dayHours.reduce((a, b) => Math.max(a, b.gust), 0);
    const meanDir = vectorMean(dayHours.map((h) => h.dir));
    console.log(
      `   → daylight: ${meanWind.toFixed(1)} kn mean, ${peakGust.toFixed(0)} kn peak gust, ${compass(meanDir)} ${Math.round(meanDir)}°`,
    );
  }
}

function shortName(id) {
  return {
    gfs_seamless: "GFS",
    meteofrance_arome_france: "AROME",
    metno_seamless: "MET-N",
    ecmwf_aifs025: "AIFS",
    icon_d2: "ICON",
  }[id] ?? id;
}

async function main() {
  const args = process.argv.slice(2);
  let spots;

  if (args.length === 0) {
    spots = Object.values(SPOTS_BY_ZONE);
  } else if (args.length === 1) {
    // Try slug match against any spot we know.
    const all = Object.values(SPOTS_BY_ZONE);
    const found = all.find((s) =>
      s.name.toLowerCase().replace(/\s+/g, "-") === args[0].toLowerCase(),
    );
    if (!found) {
      console.error(`Unknown spot "${args[0]}". Known: ${all.map((s) => s.name).join(", ")}`);
      process.exit(2);
    }
    spots = [found];
  } else if (args.length >= 2) {
    spots = [{ lat: Number(args[0]), lng: Number(args[1]), name: args[2] || `${args[0]},${args[1]}` }];
  }

  console.log("=== WindSiren per-zone blend — live output ===");
  for (const spot of spots) await processSpot(spot);
  console.log("");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
