// Stress-test the proposed GFS 13 + AROME France 1.3 blend across a
// representative set of NL kite spots before wiring it into the
// provider. Three things to check:
//
//   1. Coverage — does AROME France actually return data for the
//      whole NL coast? Its domain is centred on France; northern NL
//      (Wadden, Texel) may be outside the grid.
//
//   2. Spread — at spots where both cover, are GFS and AROME so far
//      apart that a 50/50 mean is misleading? E.g. GFS 17 / AROME 11
//      gives a blend of 14 that satisfies neither model.
//
//   3. Direction agreement — do the two models at least agree on
//      where the wind is coming from? If GFS says SW and AROME says E
//      we'd be averaging garbage.
//
// Run from repo root:
//   node tools/stress-test-blend.mjs

const SPOTS = [
  // Northern coast (Wadden — likely outside AROME France domain)
  { name: "Paal 17 Texel",      lat: 53.0814, lng: 4.7361 },
  { name: "Waddenzee Texel",    lat: 53.1670, lng: 4.8749 },
  // Mid-NL (North Holland coast)
  { name: "Wijk aan Zee",       lat: 52.4928, lng: 4.6037 },
  { name: "IJmuiden",           lat: 52.4563, lng: 4.5597 },
  // South Holland coast
  { name: "Scheveningen",       lat: 52.1083, lng: 4.2735 },
  // Zeeland (closest to French border — AROME should be confident)
  { name: "Brouwersdam",        lat: 51.7556, lng: 3.8500 },
  // Inland (IJsselmeer)
  { name: "Workum",             lat: 52.9678, lng: 5.4114 },
];

const HOURS = 12; // first 12h of forecast — covers today daylight roughly

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
  const res = await fetch(url);
  if (!res.ok) return { ok: false, status: res.status };
  const data = await res.json();
  // Empty hourly = model doesn't cover this coordinate.
  if (!data?.hourly?.time?.length) return { ok: false, status: "empty" };
  return { ok: true, hourly: data.hourly };
}

function compass(deg) {
  if (deg == null) return "—";
  const dirs = ["N","NNE","NE","ENE","E","ESE","SE","SSE",
                "S","SSW","SW","WSW","W","WNW","NW","NNW"];
  return dirs[Math.round(((deg % 360) / 22.5)) % 16];
}

// Smallest signed difference between two compass bearings, in degrees
// (0..180). Used to flag direction disagreements between models.
function angleDiff(a, b) {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}

async function main() {
  console.log("\n=== GFS 13 + AROME France 1.3 blend stress test ===\n");

  for (const spot of SPOTS) {
    console.log(`── ${spot.name} (${spot.lat}, ${spot.lng})`);

    const [gfs, arome] = await Promise.all([
      fetchModel(spot, "gfs_seamless"),
      fetchModel(spot, "meteofrance_arome_france"),
    ]);

    if (!gfs.ok) {
      console.log(`   GFS failed: ${gfs.status}`);
      continue;
    }
    if (!arome.ok) {
      console.log(
        `   ⚠️  AROME France returned ${arome.status} — coord outside model coverage. Blend would degrade to pure GFS here.\n`,
      );
      continue;
    }

    // Align by timestamp. Open-Meteo returns same hour grid for both
    // when timezone is identical, but we still join to be safe.
    const tArr = gfs.hourly.time.slice(0, HOURS);
    const aTimeMap = new Map(arome.hourly.time.map((t, i) => [t, i]));

    let header = "   Time   GFS  AROME  Blend  GFSdir AROMEdir  Δdir  GFSgust  AROMEgust  BlendGust";
    console.log(header);
    console.log("   " + "─".repeat(header.length - 3));

    let blendRows = 0;
    let bigSpread = 0;
    let bigDirDiff = 0;

    for (let i = 0; i < tArr.length; i++) {
      const t = tArr[i];
      const ai = aTimeMap.get(t);
      if (ai === undefined) continue;

      const gw = gfs.hourly.wind_speed_10m[i];
      const aw = arome.hourly.wind_speed_10m[ai];
      const gg = gfs.hourly.wind_gusts_10m[i];
      const ag = arome.hourly.wind_gusts_10m[ai];
      const gd = gfs.hourly.wind_direction_10m[i];
      const ad = arome.hourly.wind_direction_10m[ai];

      if (gw == null || aw == null) continue;
      const blend = (gw + aw) / 2;
      const blendGust = ((gg ?? 0) + (ag ?? 0)) / 2;
      const dDiff = angleDiff(gd, ad);
      const spread = Math.abs(gw - aw);

      blendRows++;
      if (spread >= 5) bigSpread++;
      if (dDiff >= 30) bigDirDiff++;

      const flag =
        spread >= 5 ? " ⚠spread" : dDiff >= 30 ? " ⚠dir" : "";
      console.log(
        `   ${t.slice(11, 16)}  ${gw.toFixed(0).padStart(3)}   ${aw.toFixed(0).padStart(3)}    ${blend.toFixed(0).padStart(3)}    ${compass(gd).padStart(4)}     ${compass(ad).padStart(4)}     ${Math.round(dDiff).toString().padStart(3)}°    ${(gg ?? 0).toFixed(0).padStart(3)}       ${(ag ?? 0).toFixed(0).padStart(3)}        ${blendGust.toFixed(0).padStart(3)}${flag}`,
      );
    }

    // Summary
    const dayWind = [];
    const dayGust = [];
    for (let i = 0; i < tArr.length; i++) {
      const t = tArr[i];
      const ai = aTimeMap.get(t);
      if (ai === undefined) continue;
      const hour = parseInt(t.slice(11, 13), 10);
      if (hour < 8 || hour > 20) continue;
      const gw = gfs.hourly.wind_speed_10m[i];
      const aw = arome.hourly.wind_speed_10m[ai];
      const gg = gfs.hourly.wind_gusts_10m[i];
      const ag = arome.hourly.wind_gusts_10m[ai];
      if (gw == null || aw == null) continue;
      dayWind.push((gw + aw) / 2);
      dayGust.push(Math.max(gg ?? 0, ag ?? 0));
    }
    const meanBlend = dayWind.reduce((a, b) => a + b, 0) / Math.max(1, dayWind.length);
    const peakGust = dayGust.length ? Math.max(...dayGust) : 0;
    console.log(
      `   → daylight blend: mean ${meanBlend.toFixed(1)} kn · peak gust ${peakGust.toFixed(0)} kn`,
    );
    console.log(
      `   → quality: ${blendRows} hrs blended · ${bigSpread} hrs with ≥5 kn spread · ${bigDirDiff} hrs with ≥30° dir disagreement\n`,
    );
  }

  console.log("Legend:");
  console.log("  ⚠spread = GFS and AROME disagree by ≥5 kn (blend may misrepresent both)");
  console.log("  ⚠dir   = direction disagreement ≥30° (averaging unreliable)\n");
  console.log("Health checks:");
  console.log("  - All NL spots returned AROME data?  → coverage OK");
  console.log("  - <30% of hours flagged ⚠?           → blend stable");
  console.log("  - Direction disagreements <10%?      → models agree on synoptic flow");
  console.log("  - Mean blend within 1-2 kn of WG WG? → good match for Windguru\n");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
