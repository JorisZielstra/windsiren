import type { ObservationSource, Observation, StationInfo } from "@windsiren/shared";

// KNMI EDR API — 10-minute in-situ meteorological observations.
// Docs: https://developer.dataplatform.knmi.nl/edr-api
//
// To use this adapter in production:
//   1. Register at https://developer.dataplatform.knmi.nl/apis and request
//      an API key (free, rate-limited to 1000 req/hour).
//   2. Store the key as KNMI_API_KEY (server-side only — this is a secret
//      and must NEVER ship in an EXPO_PUBLIC_* or NEXT_PUBLIC_* env var).
//   3. Instantiate: new KnmiObservationSource(process.env.KNMI_API_KEY).
//
// KNMI parameter codes used:
//   ff  — mean wind speed (m/s)
//   gff — maximum wind gust (m/s)
//   dd  — mean wind direction (degrees, meteorological — whence)
//   ta  — air temperature (°C)
//   ps  — surface pressure (hPa)

const KNMI_BASE = "https://api.dataplatform.knmi.nl/edr/v1";
const COLLECTION = "10-minute-in-situ-meteorological-observations";

// CoverageJSON shapes we consume. KNMI returns EITHER:
//   - type: "Coverage" (single) with domain + ranges at the root, or
//   - type: "CoverageCollection" with a `coverages: [Coverage]` array
// We normalize by unwrapping the first coverage from a collection.
type Coverage = {
  type?: string;
  domain?: {
    axes?: {
      t?: { values: string[] };
      x?: { values: number[] };
      y?: { values: number[] };
    };
  };
  ranges?: Record<
    string,
    {
      type?: string;
      values: (number | null)[];
    }
  >;
};

export type CoverageJsonResponse = Coverage & {
  coverages?: Coverage[];
};

export class KnmiObservationSource implements ObservationSource {
  readonly name = "knmi";
  private readonly apiKey: string;
  private readonly fetchImpl: typeof fetch;

  constructor(apiKey: string, fetchImpl: typeof fetch = fetch) {
    if (!apiKey) {
      throw new Error(
        "KnmiObservationSource requires an API key. Register at " +
          "https://developer.dataplatform.knmi.nl/apis",
      );
    }
    this.apiKey = apiKey;
    this.fetchImpl = fetchImpl;
  }

  async fetchLatest(stationId: string): Promise<Observation> {
    // Ask for the last 30 min — KNMI publishes every 10 min, so 30 min is
    // always enough to catch at least one reading even if the newest batch
    // is slightly delayed.
    const now = new Date();
    const thirtyMinAgo = new Date(now.getTime() - 30 * 60 * 1000);
    const datetime = `${toRfc3339(thirtyMinAgo)}/${toRfc3339(now)}`;

    // KNMI EDR locations use WIGOS identifiers: "0-20000-0-<5-digit-code>".
    // We store the short 5-digit form (e.g. "06225") in the DB for brevity
    // and add the prefix here transparently. Already-prefixed IDs pass through.
    const wigosId = stationId.startsWith("0-20000-0-")
      ? stationId
      : `0-20000-0-${stationId}`;
    const url = new URL(`${KNMI_BASE}/collections/${COLLECTION}/locations/${wigosId}`);
    url.searchParams.set("datetime", datetime);
    url.searchParams.set("parameter-name", "ff,dd,gff,ta,ps");

    const response = await this.fetchImpl(url.toString(), {
      headers: { Authorization: this.apiKey },
    });
    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(`KNMI returned ${response.status}: ${body}`);
    }

    const data = (await response.json()) as CoverageJsonResponse;
    return this.extractLatest(data, stationId);
  }

  async listStationsNear(_lat: number, _lng: number, _radiusKm: number): Promise<StationInfo[]> {
    // TODO(v1): implement via GET /collections/{id}/locations + client-side
    // distance filter. For v0.1 we set spot.knmi_station_id manually in the
    // spots table, so this method isn't required yet.
    return [];
  }

  supportsRegion(countryCode: string): boolean {
    return countryCode === "NL";
  }

  private extractLatest(data: CoverageJsonResponse, stationId: string): Observation {
    // KNMI wraps location queries in a CoverageCollection; single-location
    // queries have exactly one coverage inside. Fall back to root-level
    // domain/ranges in case a future endpoint returns a bare Coverage.
    const coverage: Coverage =
      data.type === "CoverageCollection" && data.coverages?.[0]
        ? data.coverages[0]
        : data;

    const times = coverage.domain?.axes?.t?.values ?? [];
    if (times.length === 0) {
      throw new Error(`KNMI returned no observations for station ${stationId}`);
    }

    const pick = (param: string): number | null => {
      const arr = coverage.ranges?.[param]?.values;
      if (!arr || arr.length === 0) return null;
      const v = arr[arr.length - 1];
      return typeof v === "number" ? v : null;
    };

    const observedAt = times[times.length - 1]!;
    const windSpeedMs = pick("ff");
    const windDirectionDeg = pick("dd");

    // Wind speed and direction are the safety-critical fields — fail loudly
    // if either is missing rather than fabricating zeros.
    if (windSpeedMs === null) {
      throw new Error(`KNMI station ${stationId} returned no wind speed (ff) for ${observedAt}`);
    }
    if (windDirectionDeg === null) {
      throw new Error(
        `KNMI station ${stationId} returned no wind direction (dd) for ${observedAt}`,
      );
    }

    return {
      observedAt,
      stationId,
      windSpeedMs,
      gustMs: pick("gff") ?? windSpeedMs, // fall back to mean wind if gust missing
      windDirectionDeg,
      airTempC: pick("ta"),
      waterTempC: null, // KNMI land/coastal stations don't measure sea temperature
      precipitationMm: null, // not requested in this call
      pressureHpa: pick("ps"),
    };
  }
}

// KNMI expects RFC 3339 with second precision and a 'Z' suffix.
function toRfc3339(d: Date): string {
  return d.toISOString().replace(/\.\d+Z$/, "Z");
}
