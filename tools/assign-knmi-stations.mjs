// Computes nearest live-reporting KNMI station for each NL kite spot
// that does not yet have one assigned (the 50 newly seeded spots from
// 20260429100000_seed_all_nl_spots.sql).
//
// Restricts to 0-20000-0- (WIGOS) prefixed stations because that's the
// only prefix the KnmiObservationSource currently auto-prefixes. The
// 0-528-0- (Dutch CMA) stations like Muiden and Hollandse Kust Noord
// are catalogued separately and ignored here — that's a follow-up.
//
// Usage:
//   node tools/assign-knmi-stations.mjs

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Haversine distance in km between two lat/lng pairs.
function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

// All 50 newly seeded spots — slugs that did NOT exist before
// 20260429100000_seed_all_nl_spots.sql ran. The 14 pre-existing slugs
// (some renamed, all have station IDs assigned in 20260424070000) are
// excluded.
const NEW_SPOTS = [
  // Zeeland
  { slug: "ouwerkerk", lat: 51.617716, lng: 3.953895 },
  { slug: "cadzand", lat: 51.381131, lng: 3.393173 },
  { slug: "roompot", lat: 51.594995, lng: 3.716885 },
  { slug: "baarland", lat: 51.394199, lng: 3.894396 },
  { slug: "borssele", lat: 51.434017, lng: 3.710928 },
  { slug: "vrouwenpolder", lat: 51.589292, lng: 3.637225 },
  { slug: "neeltje-jans", lat: 51.624939, lng: 3.683893 },
  { slug: "domburg", lat: 51.549956, lng: 3.459562 },
  { slug: "grevelingendam", lat: 51.678948, lng: 4.138895 },

  // South Holland
  { slug: "ouddorp", lat: 51.821462, lng: 3.880572 },
  { slug: "scheveningen-noorderstrand", lat: 52.103539, lng: 4.265553 },
  { slug: "wassenaarse-slag", lat: 52.163418, lng: 4.350723 },
  { slug: "scheveningen-zuiderstrand", lat: 52.0963, lng: 4.253775 },
  { slug: "rockanje", lat: 51.876426, lng: 4.041637 },
  { slug: "langevelderslag", lat: 52.299039, lng: 4.479717 },
  { slug: "oostvoorne", lat: 51.915884, lng: 4.060405 },
  { slug: "de-slufter", lat: 51.918621, lng: 3.995954 },
  { slug: "de-maasvlakte", lat: 51.973297, lng: 3.971726 },
  { slug: "katwijk-aan-zee", lat: 52.19648, lng: 4.385678 },
  { slug: "hoek-van-holland", lat: 51.993328, lng: 4.114316 },
  { slug: "zandmotor", lat: 52.0579, lng: 4.194985 },
  { slug: "brouwersdam", lat: 51.762086, lng: 3.852133 },

  // North Holland (new — already-seeded north-holland slugs excluded)
  { slug: "ijmuiderslag", lat: 52.445508, lng: 4.559073 },
  { slug: "den-helder", lat: 52.953333, lng: 4.72366 },
  { slug: "castricum", lat: 52.556353, lng: 4.606179 },
  { slug: "callantsoog", lat: 52.838628, lng: 4.691977 },
  { slug: "bergen-aan-zee", lat: 52.662853, lng: 4.629476 },
  { slug: "schoorl-camperduin", lat: 52.726372, lng: 4.641909 },
  { slug: "wijk-aan-zee-noordpier", lat: 52.469533, lng: 4.565104 },

  // IJsselmeer / Markermeer / inland lakes
  { slug: "amstelmeer", lat: 52.885157, lng: 4.916465 },
  { slug: "makkum", lat: 53.054297, lng: 5.374248 },
  { slug: "lemmer", lat: 52.843832, lng: 5.699438 },
  { slug: "mirns", lat: 52.851642, lng: 5.481603 },
  { slug: "ijburg", lat: 52.354589, lng: 5.017272 },
  { slug: "kornwerderzand", lat: 53.073531, lng: 5.339882 },
  { slug: "hindeloopen", lat: 52.933461, lng: 5.403571 },
  { slug: "enkhuizen", lat: 52.713333, lng: 5.289642 },
  { slug: "muiderberg", lat: 52.32963, lng: 5.11373 },
  { slug: "edam", lat: 52.54009, lng: 5.053007 },
  { slug: "horst", lat: 52.322555, lng: 5.570793 },

  // Wadden
  { slug: "texel-paal-9", lat: 53.021161, lng: 4.709989 },
  { slug: "ameland-noordzee-buren", lat: 53.465025, lng: 5.864553 },
  { slug: "schiermonnikoog-noordzeekant-paal-3", lat: 53.492973, lng: 6.145967 },
  { slug: "vlieland", lat: 53.30407, lng: 5.050656 },
  { slug: "lauwersoog", lat: 53.3965, lng: 6.15162 },
  { slug: "ameland-hollum", lat: 53.439399, lng: 5.639648 },
  { slug: "terschelling-groene-strand", lat: 53.356336, lng: 5.209301 },
  { slug: "harlingen", lat: 53.166699, lng: 5.416254 },
  { slug: "ameland-waddenzee", lat: 53.438603, lng: 5.775053 },
  { slug: "ameland-noordzee", lat: 53.460601, lng: 5.711638 },
];

const stations = JSON.parse(
  readFileSync(resolve(__dirname, "knmi-stations.json"), "utf8"),
);

const reportingWigos = stations.filter(
  (s) => s.reporting && s.id.startsWith("0-20000-0-"),
);
process.stderr.write(
  `Considering ${reportingWigos.length} reporting WIGOS stations.\n`,
);

const assignments = [];
for (const spot of NEW_SPOTS) {
  let best = null;
  for (const s of reportingWigos) {
    const km = haversineKm(spot.lat, spot.lng, s.lat, s.lng);
    if (!best || km < best.km) best = { ...s, km };
  }
  assignments.push({ slug: spot.slug, station: best.short, name: best.name, km: best.km });
}

// Group by station for the migration's grouped UPDATE statements.
const byStation = new Map();
for (const a of assignments) {
  if (!byStation.has(a.station)) {
    byStation.set(a.station, { name: a.name, members: [] });
  }
  byStation.get(a.station).members.push({ slug: a.slug, km: a.km });
}

// Print ordered by station id.
const ordered = [...byStation.entries()].sort((a, b) => a[0].localeCompare(b[0]));
for (const [station, info] of ordered) {
  const members = info.members.sort((a, b) => a.km - b.km);
  process.stdout.write(`-- ${station} ${info.name} (${members.length} spots)\n`);
  for (const m of members) {
    process.stdout.write(
      `--     ${m.slug.padEnd(38)} ${m.km.toFixed(1)} km\n`,
    );
  }
  const slugs = members.map((m) => `'${m.slug}'`).join(", ");
  process.stdout.write(
    `update public.spots set knmi_station_id = '${station}' where slug in (${slugs});\n\n`,
  );
}
