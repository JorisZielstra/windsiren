import type { TidePoint, TideSource } from "@windsiren/shared";

// Rijkswaterstaat Waterwebservices — astronomical tide extremes.
// Docs: https://rijkswaterstaatdata.nl/waterdata/
//
// Public API: no authentication or API key required. Updated 2025-12-05
// (the previous ddapi10-* host was retired in favor of ddapi20-*).
//
// Groepering GETETBRKD2 = "Getijextreem berekend" — the calculated tide
// extremes (highs + lows) for any given station and date range.
//
// The response shape is ergonomically awkward: RWS returns TWO parallel
// lists in WaarnemingenLijst:
//   1. Typering=GETETTPE (high/low label: "hoogwater" | "laagwater")
//   2. Grootheid=WATHTE  (water height in cm relative to NAP)
// Both lists share timestamps; we join on Tijdstip to build TidePoints.

const RWS_BASE =
  "https://ddapi20-waterwebservices.rijkswaterstaat.nl/ONLINEWAARNEMINGENSERVICES/OphalenWaarnemingen";

const NL_TZ = "Europe/Amsterdam";

type RwsMeting = {
  Meetwaarde: {
    Waarde_Numeriek?: number;
    Waarde_Alfanumeriek?: string;
  };
  Tijdstip: string;
};

type RwsWaarneming = {
  AquoMetadata: {
    Grootheid?: { Code: string };
    Typering?: { Code: string };
    Groepering?: { Code: string };
  };
  Locatie?: { Code: string };
  MetingenLijst: RwsMeting[];
};

export type RwsResponse = {
  Succesvol: boolean;
  WaarnemingenLijst?: RwsWaarneming[];
  Foutmelding?: string;
};

export class RijkswaterstaatTideSource implements TideSource {
  readonly name = "rijkswaterstaat";
  private readonly fetchImpl: typeof fetch;

  constructor(fetchImpl: typeof fetch = fetch) {
    this.fetchImpl = fetchImpl;
  }

  async fetchDailyEvents(stationId: string, date: string): Promise<TidePoint[]> {
    // Query a ±12h window around the target NL local day so we always catch
    // every event regardless of DST, then filter to the requested NL date.
    const anchor = new Date(`${date}T00:00:00Z`);
    const begin = new Date(anchor.getTime() - 12 * 3600_000);
    const end = new Date(anchor.getTime() + 36 * 3600_000);

    const body = {
      Locatie: { Code: stationId },
      AquoPlusWaarnemingMetadata: {
        AquoMetadata: { Groepering: { Code: "GETETBRKD2" } },
      },
      Periode: {
        Begindatumtijd: begin.toISOString().replace("Z", "+00:00"),
        Einddatumtijd: end.toISOString().replace("Z", "+00:00"),
      },
    };

    const response = await this.fetchImpl(RWS_BASE, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (response.status === 204) return [];
    if (!response.ok) {
      const errBody = await response.text().catch(() => "");
      throw new Error(`Rijkswaterstaat returned ${response.status}: ${errBody}`);
    }

    const data = (await response.json()) as RwsResponse;
    if (data.Succesvol === false) {
      throw new Error(`Rijkswaterstaat error: ${data.Foutmelding ?? "unknown"}`);
    }

    return filterToLocalDay(normalize(data), date);
  }
}

export function normalize(data: RwsResponse): TidePoint[] {
  const lists = data.WaarnemingenLijst ?? [];
  const typeList = lists.find((l) => l.AquoMetadata.Typering?.Code === "GETETTPE");
  const heightList = lists.find((l) => l.AquoMetadata.Grootheid?.Code === "WATHTE");
  if (!typeList || !heightList) return [];

  const typeByTime = new Map<string, string>();
  for (const m of typeList.MetingenLijst) {
    const label = m.Meetwaarde.Waarde_Alfanumeriek;
    if (label) typeByTime.set(m.Tijdstip, label);
  }

  const points: TidePoint[] = [];
  for (const m of heightList.MetingenLijst) {
    const label = typeByTime.get(m.Tijdstip);
    if (!label) continue; // unpaired height without a type classifier
    const heightCm = m.Meetwaarde.Waarde_Numeriek;
    if (typeof heightCm !== "number") continue;

    let type: "high" | "low";
    if (label === "hoogwater") type = "high";
    else if (label === "laagwater") type = "low";
    else continue; // unknown classifier, skip rather than guess

    points.push({ at: m.Tijdstip, type, heightCm });
  }
  return points;
}

function filterToLocalDay(points: TidePoint[], date: string): TidePoint[] {
  const nlFormatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: NL_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return points.filter((p) => nlFormatter.format(new Date(p.at)) === date);
}
