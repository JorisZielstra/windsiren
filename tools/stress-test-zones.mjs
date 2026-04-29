// Stress-test the per-region blend strategy. For each spot:
//   1. Classify into a zone by lat/lng.
//   2. Fetch every model in that zone's recipe in parallel.
//   3. Drop any model that returned empty (no coverage) or whose
//      direction disagrees with the median by ≥30° (not in flow).
//   4. Average the survivors hour-by-hour.
//   5. Print blend + each individual model side-by-side so we can
//      compare against Windguru's WG forecast manually.
//
// Run from repo root:
//   node tools/stress-test-zones.mjs
//
// After running, open the Windguru URL printed for each spot and
// compare the WG-default top-row numbers to the "BLEND" row here.

const ZONES = {
  A: {
    label: "Wadden / North coast",
    models: ["gfs_seamless", "metno_seamless", "ecmwf_ifs04"],
  },
  B: {
    label: "Central coast",
    models: ["gfs_seamless", "meteofrance_arome_france", "ecmwf_ifs04"],
  },
  C: {
    label: "Zeeland / South",
    models: ["meteofrance_arome_france", "gfs_seamless", "ecmwf_ifs04"],
  },
  D: {
    label: "Inland lakes",
    models: ["gfs_seamless", "icon_d2", "ecmwf_ifs04"],
  },
};

// Spots span all four zones. windguruId is the spot ID for manual
// cross-reference (URL: https://www.windguru.cz/{id}).
const SPOTS = [
  { name: "Paal 17 Texel",     lat: 53.0814, lng: 4.7361, windguruId: 47868, zone: "A" },
  { name: "Waddenzee Texel",   lat: 53.1670, lng: 4.8749, windguruId: 1398,  zone: "A" },
  { name: "Wijk aan Zee",      lat: 52.4928, lng: 4.6037, windguruId: 113,   zone: "B" },
  { name: "Scheveningen",      lat: 52.1083, lng: 4.2735, windguruId: 1140,  zone: "B" },
  { name: "Brouwersdam",       lat: 51.7556, lng: 3.8500, windguruId: 80,    zone: "C" },
  { name: "Workum",            lat: 52.9678, lng: 5.4114, windguruId: 1395,  zone: "D" },
  { name: "Andijk",            lat: 52.7396, lng: 5.1770, windguruId: 6280,  zone: "D" },
];

const HOURS = 12;

async function fetchModel(spot, modelId) {
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
  try {
    const res = await fetch(url);
    if (!res.ok) return { id: modelId, ok: false, status: res.status };
    const data = await res.json();
    if (!data?.hourly?.time?.length) return { id: modelId, ok: false, status: "empty" };
    return { id: modelId, ok: true, hourly: data.hourly };
  } catch (err) {
    return { id: modelId, ok: false, status: err.message };
  }
}

function compass(deg) {
  if (deg == null) return "—";
  const dirs = ["N","NNE","NE","ENE","E","ESE","SE","SSE",
                "S","SSW","SW","WSW","W","WNW","NW","NNW"];
  return dirs[Math.round(((deg % 360) / 22.5)) % 16];
}

function angleDiff(a, b) {
  if (a == null || b == null) return 0;
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}

// Median of an array of angles (compass safe — average of vectors).
function medianAngle(angles) {
  if (!angles.length) return null;
  let sx = 0, sy = 0;
  for (const a of angles) {
    sx += Math.cos((a * Math.PI) / 180);
    sy += Math.sin((a * Math.PI) / 180);
  }
  const mean = (Math.atan2(sy, sx) * 180) / Math.PI;
  return (mean + 360) % 360;
}

async function processSpot(spot) {
  const zone = ZONES[spot.zone];
  console.log(`── ${spot.name}  (Zone ${spot.zone} — ${zone.label})`);
  console.log(`   Windguru: https://www.windguru.cz/${spot.windguruId}`);

  const results = await Promise.all(zone.models.map((m) => fetchModel(spot, m)));
  const live = results.filter((r) => r.ok);
  const dead = results.filter((r) => !r.ok);

  if (dead.length) {
    for (const d of dead) {
      console.log(`   ⚠ ${d.id} — ${d.status}`);
    }
  }
  if (live.length === 0) {
    console.log(`   No models returned data. Skipping.\n`);
    return;
  }

  // Common time grid = first model's grid (Open-Meteo aligns when
  // timezone is fixed). Build per-model lookup by time.
  const refTimes = live[0].hourly.time.slice(0, HOURS);
  const lookups = live.map((r) => {
    const m = new Map();
    for (let i = 0; i < r.hourly.time.length; i++) m.set(r.hourly.time[i], i);
    return { id: r.id, hourly: r.hourly, idx: m };
  });

  // Header
  const header = [
    "Time".padEnd(7),
    ...live.map((r) => modelShort(r.id).padStart(7)),
    "BLEND".padStart(7),
    "DIR".padStart(6),
    "Note".padStart(8),
  ].join("");
  console.log(`   ${header}`);
  console.log("   " + "─".repeat(header.length));

  let totalDirected = 0;
  let totalDropped = 0;
  let blendWindAcc = 0;
  let blendGustPeak = 0;
  let blendRows = 0;

  for (const t of refTimes) {
    const winds = [];
    const dirs = [];
    const gusts = [];
    const cells = [];
    for (const m of lookups) {
      const i = m.idx.get(t);
      if (i === undefined) {
        cells.push("—");
        continue;
      }
      const w = m.hourly.wind_speed_10m[i];
      const d = m.hourly.wind_direction_10m[i];
      const g = m.hourly.wind_gusts_10m[i];
      if (w == null || d == null) {
        cells.push("—");
        continue;
      }
      winds.push({ id: m.id, w, d, g: g ?? 0 });
      dirs.push(d);
      gusts.push(g ?? 0);
      cells.push(w.toFixed(0));
    }

    if (winds.length === 0) continue;

    // Direction sanity — drop any model >30° off the median.
    const median = medianAngle(dirs);
    const kept = winds.filter((x) => angleDiff(x.d, median) < 30);
    const dropped = winds.length - kept.length;
    totalDropped += dropped;

    if (kept.length === 0) continue;

    const blend = kept.reduce((a, b) => a + b.w, 0) / kept.length;
    const blendDir = medianAngle(kept.map((x) => x.d));
    const blendGust = kept.reduce((a, b) => Math.max(a, b.g), 0);

    blendWindAcc += blend;
    blendGustPeak = Math.max(blendGustPeak, blendGust);
    blendRows++;
    totalDirected++;

    const note = dropped > 0 ? `−${dropped}drop` : "";
    const row = [
      t.slice(11, 16).padEnd(7),
      ...cells.map((c) => c.padStart(7)),
      blend.toFixed(0).padStart(7),
      compass(blendDir).padStart(6),
      note.padStart(8),
    ].join("");
    console.log(`   ${row}`);
  }

  const meanBlend = blendRows ? blendWindAcc / blendRows : 0;
  console.log(
    `   → ${HOURS}h blend mean: ${meanBlend.toFixed(1)} kn · peak gust: ${blendGustPeak.toFixed(0)} kn` +
      (totalDropped ? ` · ${totalDropped} model-hours dropped (direction)` : ""),
  );
  console.log("");
}

function modelShort(id) {
  return {
    gfs_seamless: "GFS",
    meteofrance_arome_france: "AROME",
    metno_seamless: "MET-N",
    ecmwf_ifs04: "ECMWF",
    icon_d2: "ICON-D2",
    knmi_harmonie_arome_netherlands: "HARM-NL",
  }[id] ?? id;
}

async function main() {
  console.log("\n=== Per-region blend stress test ===");
  console.log("Compare the BLEND column against Windguru's top WG row at each URL.\n");
  for (const spot of SPOTS) {
    await processSpot(spot);
  }
  console.log("Manual verification:");
  console.log("  - Open each Windguru URL above in a new tab.");
  console.log("  - For 'today' rows around 10:00–18:00, check whether the WG");
  console.log("    forecast wind speeds (top row, biggest font) match the BLEND");
  console.log("    column here within ~2 kn.");
  console.log("  - Also check that BLEND DIR matches WG's wind-direction arrows.");
  console.log("");
  console.log("If a zone consistently shows a 3+ kn gap vs Windguru, tell me which");
  console.log("zone and direction (high or low) and I'll re-tune the recipe before");
  console.log("wiring it in.\n");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
