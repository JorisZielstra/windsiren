import { describe, expect, test, vi } from "vitest";
import { OpenMeteoForecastSource } from "./open-meteo";

const MAKE_RESPONSE = (
  windKn: number[],
  gustKn: number[],
  dir = 75,
) => ({
  hourly: {
    time: ["2026-04-29T00:00", "2026-04-29T01:00", "2026-04-29T02:00"],
    temperature_2m: [9, 9, 8],
    wind_speed_10m: windKn,
    wind_gusts_10m: gustKn,
    wind_direction_10m: [dir, dir + 2, dir + 4],
    precipitation: [0, 0, 0],
    cloud_cover: [40, 50, 55],
  },
});

// Build a fetch mock that returns the right payload based on which
// model is requested via the `models=` query string. Order matters
// only for fallthrough — the first matching key wins.
function modelMock(routes: Record<string, object | null>) {
  return vi.fn().mockImplementation(async (url: string) => {
    for (const [model, response] of Object.entries(routes)) {
      if (url.includes(`models=${model}`)) {
        if (response === null) {
          return {
            ok: false,
            status: 400,
            json: async () => ({}),
            text: async () => "",
          };
        }
        return {
          ok: true,
          status: 200,
          json: async () => response,
          text: async () => "",
        };
      }
    }
    throw new Error(`unmocked URL: ${url}`);
  });
}

describe("OpenMeteoForecastSource", () => {
  test("identifies itself as open_meteo", () => {
    expect(new OpenMeteoForecastSource().name).toBe("open_meteo");
  });

  test("supportsRegion returns true everywhere", () => {
    const s = new OpenMeteoForecastSource();
    expect(s.supportsRegion("NL")).toBe(true);
    expect(s.supportsRegion("US")).toBe(true);
  });

  test("Zone B spot fetches GFS + AROME-FR + ECMWF AIFS in parallel", async () => {
    const fetchImpl = modelMock({
      gfs_seamless: MAKE_RESPONSE([10, 11, 12], [14, 15, 16]),
      meteofrance_arome_france: MAKE_RESPONSE([12, 13, 14], [18, 19, 20]),
      ecmwf_aifs025: MAKE_RESPONSE([11, 12, 13], [15, 16, 17]),
    });
    const source = new OpenMeteoForecastSource(
      fetchImpl as unknown as typeof fetch,
    );
    // Wijk aan Zee — Zone B.
    await source.fetchHourly(52.4928, 4.6037, 3);

    expect(fetchImpl).toHaveBeenCalledTimes(3);
    const urls = fetchImpl.mock.calls.map((c) => String(c[0]));
    expect(urls.some((u) => u.includes("models=gfs_seamless"))).toBe(true);
    expect(urls.some((u) => u.includes("models=meteofrance_arome_france"))).toBe(true);
    expect(urls.some((u) => u.includes("models=ecmwf_aifs025"))).toBe(true);
  });

  test("Zone A spot uses MET Nordic instead of AROME France", async () => {
    const fetchImpl = modelMock({
      gfs_seamless: MAKE_RESPONSE([10, 11, 12], [14, 15, 16]),
      metno_seamless: MAKE_RESPONSE([12, 13, 14], [16, 17, 18]),
      ecmwf_aifs025: MAKE_RESPONSE([11, 12, 13], [15, 16, 17]),
    });
    const source = new OpenMeteoForecastSource(
      fetchImpl as unknown as typeof fetch,
    );
    // Waddenzee Texel — Zone A.
    await source.fetchHourly(53.167, 4.875, 3);

    const urls = fetchImpl.mock.calls.map((c) => String(c[0]));
    expect(urls.some((u) => u.includes("models=metno_seamless"))).toBe(true);
    expect(urls.some((u) => u.includes("models=meteofrance_arome_france"))).toBe(false);
  });

  test("Zone D spot uses ICON-D2", async () => {
    const fetchImpl = modelMock({
      gfs_seamless: MAKE_RESPONSE([10, 11, 12], [14, 15, 16]),
      icon_d2: MAKE_RESPONSE([12, 13, 14], [16, 17, 18]),
      ecmwf_aifs025: MAKE_RESPONSE([11, 12, 13], [15, 16, 17]),
    });
    const source = new OpenMeteoForecastSource(
      fetchImpl as unknown as typeof fetch,
    );
    await source.fetchHourly(52.9678, 5.4114, 3); // Workum

    const urls = fetchImpl.mock.calls.map((c) => String(c[0]));
    expect(urls.some((u) => u.includes("models=icon_d2"))).toBe(true);
  });

  test("AROME gust is capped at 1.4× GFS gust in the blend", async () => {
    // GFS gust 10 → cap = 14. AROME spike to 25. Blend should report 14.
    // Pass identical wind arrays so the wind mean is unambiguous and
    // the test assertion is purely on gust capping behaviour.
    const fetchImpl = modelMock({
      gfs_seamless: MAKE_RESPONSE([10, 10, 10], [10, 10, 10]),
      meteofrance_arome_france: MAKE_RESPONSE([10, 10, 10], [25, 25, 25]),
      ecmwf_aifs025: null, // simulate "no NL coverage" for AIFS
    });
    const source = new OpenMeteoForecastSource(
      fetchImpl as unknown as typeof fetch,
    );
    const hours = await source.fetchHourly(52.4928, 4.6037, 3);
    expect(hours.length).toBeGreaterThan(0);
    // Expected behaviour: AROME's 25 capped to 14, GFS at 10, max = 14.
    expect(hours[0]!.gustMs).toBe(14);
  });

  test("blend survives one model returning empty (silent coverage gap)", async () => {
    const fetchImpl = modelMock({
      gfs_seamless: MAKE_RESPONSE([10, 11, 12], [14, 15, 16]),
      meteofrance_arome_france: null, // outside coverage
      ecmwf_aifs025: MAKE_RESPONSE([11, 12, 13], [15, 16, 17]),
    });
    const source = new OpenMeteoForecastSource(
      fetchImpl as unknown as typeof fetch,
    );
    const hours = await source.fetchHourly(52.4928, 4.6037, 3);
    expect(hours).toHaveLength(3);
    // Mean of GFS 10 and ECMWF 11 = 10.5.
    expect(hours[0]!.windSpeedMs).toBeCloseTo(10.5);
  });

  test("returns empty array when every model fails (never throws)", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
      json: async () => ({}),
      text: async () => "",
    });
    const source = new OpenMeteoForecastSource(
      fetchImpl as unknown as typeof fetch,
    );
    const hours = await source.fetchHourly(52.4928, 4.6037, 3);
    expect(hours).toEqual([]);
  });

  test("does NOT cache empty results — transient failures self-heal", async () => {
    let call = 0;
    const fetchImpl = vi.fn().mockImplementation(async () => {
      call++;
      // First three calls (one per model in the recipe) all fail.
      // Subsequent calls return data so the second invocation finds it.
      if (call <= 3) {
        return { ok: false, status: 503, json: async () => ({}), text: async () => "" };
      }
      return {
        ok: true,
        status: 200,
        json: async () => MAKE_RESPONSE([10, 11, 12], [14, 15, 16]),
        text: async () => "",
      };
    });
    const source = new OpenMeteoForecastSource(
      fetchImpl as unknown as typeof fetch,
    );
    const first = await source.fetchHourly(52.4928, 4.6037, 3);
    expect(first).toEqual([]);
    // If empty was cached, second call would also be empty without
    // hitting the network. We assert the opposite: it tries again.
    const second = await source.fetchHourly(52.4928, 4.6037, 3);
    expect(second.length).toBeGreaterThan(0);
  });

  test("caches non-empty results — second call within TTL doesn't refetch", async () => {
    const fetchImpl = modelMock({
      gfs_seamless: MAKE_RESPONSE([10, 11, 12], [14, 15, 16]),
      meteofrance_arome_france: MAKE_RESPONSE([12, 13, 14], [18, 19, 20]),
      ecmwf_aifs025: MAKE_RESPONSE([11, 12, 13], [15, 16, 17]),
    });
    const source = new OpenMeteoForecastSource(
      fetchImpl as unknown as typeof fetch,
    );
    await source.fetchHourly(52.4928, 4.6037, 3);
    const callsAfterFirst = fetchImpl.mock.calls.length;
    await source.fetchHourly(52.4928, 4.6037, 3);
    expect(fetchImpl.mock.calls.length).toBe(callsAfterFirst); // no new calls
  });

  test("retries on 429 instead of treating it as no-coverage", async () => {
    let call = 0;
    const fetchImpl = vi.fn().mockImplementation(async () => {
      call++;
      // First call to each model returns 429; subsequent calls succeed.
      // 3 models × first call rate-limited = 3, then 3 successful = total 6.
      if (call <= 3) {
        return { ok: false, status: 429, json: async () => ({}), text: async () => "" };
      }
      return {
        ok: true,
        status: 200,
        json: async () => MAKE_RESPONSE([10, 11, 12], [14, 15, 16]),
        text: async () => "",
      };
    });
    const source = new OpenMeteoForecastSource(
      fetchImpl as unknown as typeof fetch,
    );
    const hours = await source.fetchHourly(52.4928, 4.6037, 3);
    expect(hours.length).toBeGreaterThan(0);
    expect(fetchImpl.mock.calls.length).toBeGreaterThanOrEqual(6); // 3× retried, then 3× success
  });

  test("appends Z suffix to GMT timestamps", async () => {
    const fetchImpl = modelMock({
      gfs_seamless: MAKE_RESPONSE([10, 11, 12], [14, 15, 16]),
      meteofrance_arome_france: MAKE_RESPONSE([12, 13, 14], [18, 19, 20]),
      ecmwf_aifs025: MAKE_RESPONSE([11, 12, 13], [15, 16, 17]),
    });
    const source = new OpenMeteoForecastSource(
      fetchImpl as unknown as typeof fetch,
    );
    const hours = await source.fetchHourly(52.4928, 4.6037, 3);
    for (const h of hours) expect(h.time.endsWith("Z")).toBe(true);
  });
});
