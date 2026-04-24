import { describe, test, expect, vi } from "vitest";
import {
  RijkswaterstaatTideSource,
  normalize,
  type RwsResponse,
} from "./rijkswaterstaat";

// Realistic response shape captured from a live Hoek van Holland probe.
const SAMPLE_RESPONSE: RwsResponse = {
  Succesvol: true,
  WaarnemingenLijst: [
    {
      AquoMetadata: {
        Groepering: { Code: "GETETBRKD2" },
        Typering: { Code: "GETETTPE" },
      },
      Locatie: { Code: "hoekvanholland" },
      MetingenLijst: [
        {
          Meetwaarde: { Waarde_Alfanumeriek: "laagwater", Waarde_Numeriek: 0.0 },
          Tijdstip: "2026-04-24T01:16:00.000+01:00",
        },
        {
          Meetwaarde: { Waarde_Alfanumeriek: "hoogwater", Waarde_Numeriek: 0.0 },
          Tijdstip: "2026-04-24T07:51:00.000+01:00",
        },
        {
          Meetwaarde: { Waarde_Alfanumeriek: "laagwater", Waarde_Numeriek: 0.0 },
          Tijdstip: "2026-04-24T14:32:00.000+01:00",
        },
        {
          Meetwaarde: { Waarde_Alfanumeriek: "hoogwater", Waarde_Numeriek: 0.0 },
          Tijdstip: "2026-04-24T20:49:00.000+01:00",
        },
      ],
    },
    {
      AquoMetadata: {
        Groepering: { Code: "GETETBRKD2" },
        Grootheid: { Code: "WATHTE" },
      },
      Locatie: { Code: "hoekvanholland" },
      MetingenLijst: [
        {
          Meetwaarde: { Waarde_Numeriek: -80.0 },
          Tijdstip: "2026-04-24T01:16:00.000+01:00",
        },
        {
          Meetwaarde: { Waarde_Numeriek: 106.0 },
          Tijdstip: "2026-04-24T07:51:00.000+01:00",
        },
        {
          Meetwaarde: { Waarde_Numeriek: -60.0 },
          Tijdstip: "2026-04-24T14:32:00.000+01:00",
        },
        {
          Meetwaarde: { Waarde_Numeriek: 66.0 },
          Tijdstip: "2026-04-24T20:49:00.000+01:00",
        },
      ],
    },
  ],
};

function mockFetch(response: unknown, status = 200) {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: async () => response,
    text: async () =>
      typeof response === "string" ? response : JSON.stringify(response),
  });
}

describe("normalize", () => {
  test("joins the type list and height list by timestamp", () => {
    const points = normalize(SAMPLE_RESPONSE);
    expect(points).toHaveLength(4);
    expect(points[0]).toEqual({
      at: "2026-04-24T01:16:00.000+01:00",
      type: "low",
      heightCm: -80,
    });
    expect(points[1]).toEqual({
      at: "2026-04-24T07:51:00.000+01:00",
      type: "high",
      heightCm: 106,
    });
  });

  test("returns [] when either the type list or height list is missing", () => {
    const partial: RwsResponse = {
      Succesvol: true,
      WaarnemingenLijst: [SAMPLE_RESPONSE.WaarnemingenLijst![0]!], // only type list
    };
    expect(normalize(partial)).toEqual([]);
  });

  test("skips height entries with no matching type classifier", () => {
    const mismatched: RwsResponse = {
      Succesvol: true,
      WaarnemingenLijst: [
        {
          AquoMetadata: { Typering: { Code: "GETETTPE" } },
          MetingenLijst: [
            {
              Meetwaarde: { Waarde_Alfanumeriek: "hoogwater" },
              Tijdstip: "2026-04-24T07:51:00.000+01:00",
            },
          ],
        },
        {
          AquoMetadata: { Grootheid: { Code: "WATHTE" } },
          MetingenLijst: [
            {
              Meetwaarde: { Waarde_Numeriek: 106 },
              Tijdstip: "2026-04-24T07:51:00.000+01:00",
            },
            {
              Meetwaarde: { Waarde_Numeriek: -60 },
              Tijdstip: "2026-04-24T14:32:00.000+01:00", // unpaired
            },
          ],
        },
      ],
    };
    const points = normalize(mismatched);
    expect(points).toHaveLength(1);
    expect(points[0]?.at).toBe("2026-04-24T07:51:00.000+01:00");
  });

  test("skips unknown classifiers (not hoogwater/laagwater)", () => {
    const unknown: RwsResponse = {
      Succesvol: true,
      WaarnemingenLijst: [
        {
          AquoMetadata: { Typering: { Code: "GETETTPE" } },
          MetingenLijst: [
            {
              Meetwaarde: { Waarde_Alfanumeriek: "middenwater" },
              Tijdstip: "2026-04-24T07:51:00.000+01:00",
            },
          ],
        },
        {
          AquoMetadata: { Grootheid: { Code: "WATHTE" } },
          MetingenLijst: [
            {
              Meetwaarde: { Waarde_Numeriek: 50 },
              Tijdstip: "2026-04-24T07:51:00.000+01:00",
            },
          ],
        },
      ],
    };
    expect(normalize(unknown)).toEqual([]);
  });
});

describe("RijkswaterstaatTideSource", () => {
  test("identifies itself as rijkswaterstaat", () => {
    const source = new RijkswaterstaatTideSource();
    expect(source.name).toBe("rijkswaterstaat");
  });

  test("fetches daily events and filters to the requested NL-local date", async () => {
    const fetchImpl = mockFetch(SAMPLE_RESPONSE);
    const source = new RijkswaterstaatTideSource(fetchImpl as unknown as typeof fetch);

    const events = await source.fetchDailyEvents("hoekvanholland", "2026-04-24");

    expect(events).toHaveLength(4);
    expect(events.map((e) => e.type)).toEqual(["low", "high", "low", "high"]);
    expect(events.map((e) => e.heightCm)).toEqual([-80, 106, -60, 66]);
  });

  test("filters out events from adjacent days", async () => {
    const leakyResponse: RwsResponse = {
      Succesvol: true,
      WaarnemingenLijst: [
        {
          AquoMetadata: { Typering: { Code: "GETETTPE" } },
          MetingenLijst: [
            {
              Meetwaarde: { Waarde_Alfanumeriek: "hoogwater" },
              Tijdstip: "2026-04-23T20:00:00.000+02:00", // 23 Apr NL (18 UTC)
            },
            {
              Meetwaarde: { Waarde_Alfanumeriek: "hoogwater" },
              Tijdstip: "2026-04-24T08:00:00.000+02:00", // 24 Apr NL (target)
            },
            {
              Meetwaarde: { Waarde_Alfanumeriek: "hoogwater" },
              Tijdstip: "2026-04-25T07:00:00.000+02:00", // 25 Apr NL
            },
          ],
        },
        {
          AquoMetadata: { Grootheid: { Code: "WATHTE" } },
          MetingenLijst: [
            { Meetwaarde: { Waarde_Numeriek: 100 }, Tijdstip: "2026-04-23T20:00:00.000+02:00" },
            { Meetwaarde: { Waarde_Numeriek: 110 }, Tijdstip: "2026-04-24T08:00:00.000+02:00" },
            { Meetwaarde: { Waarde_Numeriek: 105 }, Tijdstip: "2026-04-25T07:00:00.000+02:00" },
          ],
        },
      ],
    };
    const fetchImpl = mockFetch(leakyResponse);
    const source = new RijkswaterstaatTideSource(fetchImpl as unknown as typeof fetch);

    const events = await source.fetchDailyEvents("hoekvanholland", "2026-04-24");
    expect(events).toHaveLength(1);
    expect(events[0]?.heightCm).toBe(110);
  });

  test("constructs a POST with the expected body shape", async () => {
    const fetchImpl = mockFetch(SAMPLE_RESPONSE);
    const source = new RijkswaterstaatTideSource(fetchImpl as unknown as typeof fetch);
    await source.fetchDailyEvents("hoekvanholland", "2026-04-24");

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0] ?? [];
    expect(String(url)).toContain("ddapi20-waterwebservices.rijkswaterstaat.nl");
    expect(String(url)).toContain("ONLINEWAARNEMINGENSERVICES/OphalenWaarnemingen");
    const reqInit = init as RequestInit;
    expect(reqInit.method).toBe("POST");
    expect((reqInit.headers as Record<string, string>)["Content-Type"]).toBe("application/json");

    const body = JSON.parse(String(reqInit.body));
    expect(body.Locatie.Code).toBe("hoekvanholland");
    expect(body.AquoPlusWaarnemingMetadata.AquoMetadata.Groepering.Code).toBe("GETETBRKD2");
    expect(body.Periode.Begindatumtijd).toMatch(/2026-04-23T12:00:00\.000\+00:00/);
    expect(body.Periode.Einddatumtijd).toMatch(/2026-04-25T12:00:00\.000\+00:00/);
  });

  test("returns [] when the API responds with 204 No Content", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      status: 204,
      json: async () => null,
      text: async () => "",
    });
    const source = new RijkswaterstaatTideSource(fetchImpl as unknown as typeof fetch);

    const events = await source.fetchDailyEvents("unknown-station", "2026-04-24");
    expect(events).toEqual([]);
  });

  test("throws when the API returns a non-2xx status", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({}),
      text: async () => "Internal Server Error",
    });
    const source = new RijkswaterstaatTideSource(fetchImpl as unknown as typeof fetch);

    await expect(source.fetchDailyEvents("any", "2026-04-24")).rejects.toThrow(/500/);
  });

  test("throws when Succesvol is false", async () => {
    const fetchImpl = mockFetch({ Succesvol: false, Foutmelding: "bad station code" });
    const source = new RijkswaterstaatTideSource(fetchImpl as unknown as typeof fetch);

    await expect(source.fetchDailyEvents("typo", "2026-04-24")).rejects.toThrow(/bad station code/);
  });
});
