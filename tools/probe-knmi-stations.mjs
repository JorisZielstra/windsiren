// One-off: probe KNMI EDR for the live catalog of 10-min in-situ stations
// and verify which are actively reporting wind (ff + dd) right now.
//
// Companion to migrations 20260424070000 / 20260424080000 — same approach
// used for the original 14 spots, now extended to the full NL spot set.
//
// Usage:
//   node tools/probe-knmi-stations.mjs > tools/knmi-stations.json
//
// Reads NEXT_PUBLIC_KNMI_API_KEY from apps/web/.env.local.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadKnmiKey() {
  const candidates = [
    resolve(__dirname, "../apps/web/.env.local"),
    resolve(__dirname, "../apps/mobile/.env.local"),
  ];
  for (const path of candidates) {
    let raw;
    try {
      raw = readFileSync(path, "utf8");
    } catch {
      continue;
    }
    const m = raw.match(/^(?:NEXT_PUBLIC_|EXPO_PUBLIC_)?KNMI_API_KEY\s*=\s*(.+)$/m);
    if (m && m[1] && m[1].trim() !== "REPLACE_ME") return m[1].trim();
  }
  throw new Error("No KNMI_API_KEY found in apps/web/.env.local");
}

const KEY = loadKnmiKey();
const BASE = "https://api.dataplatform.knmi.nl/edr/v1";
const COLLECTION = "10-minute-in-situ-meteorological-observations";

function rfc3339(d) {
  return d.toISOString().replace(/\.\d+Z$/, "Z");
}

async function listLocations() {
  const url = `${BASE}/collections/${COLLECTION}/locations`;
  const res = await fetch(url, { headers: { Authorization: KEY } });
  if (!res.ok) {
    throw new Error(`KNMI locations ${res.status}: ${await res.text()}`);
  }
  const data = await res.json();
  // KNMI returns a GeoJSON FeatureCollection of station locations.
  if (!data || data.type !== "FeatureCollection" || !Array.isArray(data.features)) {
    throw new Error("Unexpected /locations response shape");
  }
  return data.features.map((f) => {
    const id = f.id ?? f.properties?.id ?? f.properties?.name;
    const [lng, lat] = f.geometry?.coordinates ?? [null, null];
    return {
      id: String(id),
      // Strip the WIGOS prefix to get the short 5-digit form used in DB.
      short: String(id).replace(/^0-20000-0-/, ""),
      name: f.properties?.name ?? f.properties?.description ?? null,
      lat,
      lng,
    };
  });
}

async function probeStation(stationId) {
  const now = new Date();
  const sixtyMinAgo = new Date(now.getTime() - 60 * 60 * 1000);
  const datetime = `${rfc3339(sixtyMinAgo)}/${rfc3339(now)}`;
  const url = new URL(`${BASE}/collections/${COLLECTION}/locations/${stationId}`);
  url.searchParams.set("datetime", datetime);
  url.searchParams.set("parameter-name", "ff,dd,gff");

  const res = await fetch(url.toString(), { headers: { Authorization: KEY } });
  if (!res.ok) return { reporting: false, reason: `HTTP ${res.status}` };

  const data = await res.json();
  const cov =
    data.type === "CoverageCollection" && data.coverages?.[0] ? data.coverages[0] : data;
  const times = cov?.domain?.axes?.t?.values ?? [];
  if (times.length === 0) return { reporting: false, reason: "no time axis" };

  const ff = cov?.ranges?.ff?.values ?? [];
  const dd = cov?.ranges?.dd?.values ?? [];
  const lastFf = ff.length ? ff[ff.length - 1] : null;
  const lastDd = dd.length ? dd[dd.length - 1] : null;
  if (typeof lastFf !== "number" || typeof lastDd !== "number") {
    return { reporting: false, reason: "ff/dd null at latest", observedAt: times[times.length - 1] };
  }
  return {
    reporting: true,
    observedAt: times[times.length - 1],
    ff: lastFf,
    dd: lastDd,
  };
}

async function main() {
  process.stderr.write("Listing KNMI 10-min stations…\n");
  const stations = await listLocations();
  process.stderr.write(`  ${stations.length} stations in catalog\n`);

  const results = [];
  let i = 0;
  for (const s of stations) {
    i += 1;
    process.stderr.write(`  [${i}/${stations.length}] ${s.short} ${s.name ?? ""}…`);
    let probe;
    try {
      probe = await probeStation(s.id);
    } catch (err) {
      probe = { reporting: false, reason: `error: ${err.message}` };
    }
    process.stderr.write(probe.reporting ? " ✓\n" : ` ✗ (${probe.reason})\n`);
    results.push({ ...s, ...probe });
    // Be polite — KNMI rate limit is 1000/hour but no need to burn it.
    await new Promise((r) => setTimeout(r, 50));
  }

  process.stdout.write(JSON.stringify(results, null, 2) + "\n");
  const reporting = results.filter((r) => r.reporting).length;
  process.stderr.write(`\nDone. ${reporting}/${results.length} stations reporting wind right now.\n`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
