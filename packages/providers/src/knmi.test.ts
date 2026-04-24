import { describe, test, expect, vi } from "vitest";
import { KnmiObservationSource, type CoverageJsonResponse } from "./knmi";

function sampleCoverageJson(overrides: Partial<CoverageJsonResponse> = {}): CoverageJsonResponse {
  return {
    type: "Coverage",
    domain: {
      axes: {
        t: { values: ["2026-04-24T05:30:00Z", "2026-04-24T05:40:00Z", "2026-04-24T05:50:00Z"] },
        x: { values: [4.581] },
        y: { values: [52.483] },
      },
    },
    ranges: {
      ff: { type: "NdArray", values: [5.1, 5.4, 5.8] },
      gff: { type: "NdArray", values: [7.2, 7.5, 8.0] },
      dd: { type: "NdArray", values: [240, 245, 250] },
      ta: { type: "NdArray", values: [7.2, 7.3, 7.4] },
      ps: { type: "NdArray", values: [1015.2, 1015.1, 1015.0] },
    },
    ...overrides,
  };
}

function mockFetch(response: object, ok = true, status = 200) {
  return vi.fn().mockResolvedValue({
    ok,
    status,
    json: async () => response,
    text: async () => JSON.stringify(response),
  });
}

describe("KnmiObservationSource", () => {
  test("throws if constructed without an API key", () => {
    expect(() => new KnmiObservationSource("")).toThrow(/API key/i);
  });

  test("identifies itself as knmi", () => {
    const source = new KnmiObservationSource("test-key");
    expect(source.name).toBe("knmi");
  });

  test("supportsRegion only returns true for NL", () => {
    const source = new KnmiObservationSource("test-key");
    expect(source.supportsRegion("NL")).toBe(true);
    expect(source.supportsRegion("DE")).toBe(false);
    expect(source.supportsRegion("US")).toBe(false);
  });

  test("fetches and extracts the latest 10-min observation", async () => {
    const fetchImpl = mockFetch(sampleCoverageJson());
    const source = new KnmiObservationSource("test-key", fetchImpl as unknown as typeof fetch);

    const obs = await source.fetchLatest("06225");

    expect(obs.stationId).toBe("06225");
    expect(obs.observedAt).toBe("2026-04-24T05:50:00Z");
    expect(obs.windSpeedMs).toBe(5.8);
    expect(obs.gustMs).toBe(8.0);
    expect(obs.windDirectionDeg).toBe(250);
    expect(obs.airTempC).toBe(7.4);
    expect(obs.pressureHpa).toBe(1015.0);
    expect(obs.waterTempC).toBeNull();
    expect(obs.precipitationMm).toBeNull();
  });

  test("sends Authorization header with the API key", async () => {
    const fetchImpl = mockFetch(sampleCoverageJson());
    const source = new KnmiObservationSource(
      "secret-key-123",
      fetchImpl as unknown as typeof fetch,
    );
    await source.fetchLatest("06225");

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [, init] = fetchImpl.mock.calls[0] ?? [];
    expect((init as RequestInit)?.headers).toEqual({ Authorization: "secret-key-123" });
  });

  test("constructs URL with correct path, parameter-name, and 30-min datetime window", async () => {
    const fetchImpl = mockFetch(sampleCoverageJson());
    const source = new KnmiObservationSource("test-key", fetchImpl as unknown as typeof fetch);
    await source.fetchLatest("06225");

    const url = fetchImpl.mock.calls[0]?.[0] as string;
    expect(url).toContain("api.dataplatform.knmi.nl/edr/v1");
    expect(url).toContain("10-minute-in-situ-meteorological-observations");
    expect(url).toContain("/locations/0-20000-0-06225");
    expect(url).toContain("parameter-name=ff%2Cdd%2Cgff%2Cta%2Cps");
    expect(url).toMatch(/datetime=\d{4}-\d{2}-\d{2}T\d{2}%3A\d{2}%3A\d{2}Z%2F\d{4}-\d{2}-\d{2}T\d{2}%3A\d{2}%3A\d{2}Z/);
  });

  test("falls back gust to wind speed when gust value is missing", async () => {
    const payload = sampleCoverageJson({
      ranges: {
        ff: { type: "NdArray", values: [6.0] },
        dd: { type: "NdArray", values: [270] },
        // gff absent entirely
      },
      domain: { axes: { t: { values: ["2026-04-24T06:00:00Z"] } } },
    });
    const fetchImpl = mockFetch(payload);
    const source = new KnmiObservationSource("test-key", fetchImpl as unknown as typeof fetch);

    const obs = await source.fetchLatest("06225");
    expect(obs.gustMs).toBe(6.0); // == windSpeedMs fallback
  });

  test("SAFETY: throws if wind speed (ff) is missing for the latest timestamp", async () => {
    const payload = sampleCoverageJson({
      ranges: {
        dd: { type: "NdArray", values: [270] },
        // no ff
      },
      domain: { axes: { t: { values: ["2026-04-24T06:00:00Z"] } } },
    });
    const fetchImpl = mockFetch(payload);
    const source = new KnmiObservationSource("test-key", fetchImpl as unknown as typeof fetch);

    await expect(source.fetchLatest("06225")).rejects.toThrow(/wind speed/i);
  });

  test("SAFETY: throws if wind direction (dd) is missing for the latest timestamp", async () => {
    const payload = sampleCoverageJson({
      ranges: {
        ff: { type: "NdArray", values: [6.0] },
        // no dd
      },
      domain: { axes: { t: { values: ["2026-04-24T06:00:00Z"] } } },
    });
    const fetchImpl = mockFetch(payload);
    const source = new KnmiObservationSource("test-key", fetchImpl as unknown as typeof fetch);

    await expect(source.fetchLatest("06225")).rejects.toThrow(/wind direction/i);
  });

  test("throws with status in message on non-2xx response", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      text: async () => "Unauthorized — invalid API key",
      json: async () => ({}),
    });
    const source = new KnmiObservationSource("bad-key", fetchImpl as unknown as typeof fetch);

    await expect(source.fetchLatest("06225")).rejects.toThrow(/401/);
  });

  test("throws if no observations are returned (empty time axis)", async () => {
    const payload = sampleCoverageJson({
      domain: { axes: { t: { values: [] } } },
      ranges: {},
    });
    const fetchImpl = mockFetch(payload);
    const source = new KnmiObservationSource("test-key", fetchImpl as unknown as typeof fetch);

    await expect(source.fetchLatest("06225")).rejects.toThrow(/no observations/i);
  });

  test("passes through an already-WIGOS-prefixed station ID unchanged", async () => {
    const fetchImpl = mockFetch(sampleCoverageJson());
    const source = new KnmiObservationSource("test-key", fetchImpl as unknown as typeof fetch);
    await source.fetchLatest("0-20000-0-06225");

    const url = fetchImpl.mock.calls[0]?.[0] as string;
    // Should NOT double-prefix
    expect(url).toContain("/locations/0-20000-0-06225");
    expect(url).not.toContain("/locations/0-20000-0-0-20000-0-");
  });

  test("unwraps a CoverageCollection (KNMI's actual production shape)", async () => {
    const collection: CoverageJsonResponse = {
      type: "CoverageCollection",
      coverages: [
        {
          type: "Coverage",
          domain: { axes: { t: { values: ["2026-04-24T07:10:00Z"] } } },
          ranges: {
            ff: { values: [4.5] },
            gff: { values: [6.2] },
            dd: { values: [230] },
            ta: { values: [8.1] },
            ps: { values: [1018] },
          },
        },
      ],
    };
    const fetchImpl = mockFetch(collection);
    const source = new KnmiObservationSource("test-key", fetchImpl as unknown as typeof fetch);

    const obs = await source.fetchLatest("06225");
    expect(obs.observedAt).toBe("2026-04-24T07:10:00Z");
    expect(obs.windSpeedMs).toBe(4.5);
    expect(obs.gustMs).toBe(6.2);
    expect(obs.windDirectionDeg).toBe(230);
    expect(obs.airTempC).toBe(8.1);
    expect(obs.pressureHpa).toBe(1018);
  });

  test("listStationsNear returns [] (deferred to v1)", async () => {
    const source = new KnmiObservationSource("test-key");
    const stations = await source.listStationsNear(52.5, 4.5, 25);
    expect(stations).toEqual([]);
  });
});
