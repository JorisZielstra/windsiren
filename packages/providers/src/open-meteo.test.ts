import { describe, test, expect, vi } from "vitest";
import { OpenMeteoForecastSource } from "./open-meteo";

const SAMPLE_RESPONSE = {
  hourly: {
    time: ["2026-04-23T12:00", "2026-04-23T13:00", "2026-04-23T14:00"],
    temperature_2m: [15, 16, 16.5],
    wind_speed_10m: [10.5, 11.0, 11.2],
    wind_gusts_10m: [14, 15, 15.3],
    wind_direction_10m: [270, 275, 280],
    precipitation: [0, 0.2, 0],
    cloud_cover: [30, 40, 45],
  },
};

function mockFetch(response: object, ok = true, status = 200) {
  return vi.fn().mockResolvedValue({
    ok,
    status,
    json: async () => response,
    text: async () => JSON.stringify(response),
  });
}

describe("OpenMeteoForecastSource", () => {
  test("identifies itself as open_meteo", () => {
    const source = new OpenMeteoForecastSource();
    expect(source.name).toBe("open_meteo");
  });

  test("supportsRegion returns true for any country", () => {
    const source = new OpenMeteoForecastSource();
    expect(source.supportsRegion("NL")).toBe(true);
    expect(source.supportsRegion("DE")).toBe(true);
    expect(source.supportsRegion("US")).toBe(true);
  });

  test("fetches and normalizes hourly forecast", async () => {
    const fetchImpl = mockFetch(SAMPLE_RESPONSE) as unknown as typeof fetch;
    const source = new OpenMeteoForecastSource(fetchImpl);

    const forecast = await source.fetchHourly(52.5, 4.5, 3);

    expect(forecast).toHaveLength(3);
    expect(forecast[0]).toEqual({
      time: "2026-04-23T12:00Z",
      windSpeedMs: 10.5,
      gustMs: 14,
      windDirectionDeg: 270,
      airTempC: 15,
      waterTempC: null,
      precipitationMm: 0,
      cloudCoveragePct: 30,
    });
  });

  test("appends Z suffix to GMT timestamps (ISO 8601 UTC)", async () => {
    const fetchImpl = mockFetch(SAMPLE_RESPONSE) as unknown as typeof fetch;
    const source = new OpenMeteoForecastSource(fetchImpl);

    const forecast = await source.fetchHourly(52.5, 4.5, 3);

    for (const hour of forecast) {
      expect(hour.time.endsWith("Z")).toBe(true);
    }
  });

  test("always returns waterTempC as null (endpoint doesn't provide it)", async () => {
    const fetchImpl = mockFetch(SAMPLE_RESPONSE) as unknown as typeof fetch;
    const source = new OpenMeteoForecastSource(fetchImpl);

    const forecast = await source.fetchHourly(52.5, 4.5, 3);

    for (const hour of forecast) {
      expect(hour.waterTempC).toBeNull();
    }
  });

  test("constructs URL with correct query params", async () => {
    const fetchImpl = mockFetch(SAMPLE_RESPONSE);
    const source = new OpenMeteoForecastSource(fetchImpl as unknown as typeof fetch);
    await source.fetchHourly(52.48263, 4.581581, 3);

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const url = fetchImpl.mock.calls[0]?.[0] as string;
    expect(url).toContain("api.open-meteo.com");
    expect(url).toContain("latitude=52.48263");
    expect(url).toContain("longitude=4.581581");
    expect(url).toContain("forecast_days=3");
    expect(url).toContain("wind_speed_unit=ms");
    expect(url).toContain("timezone=GMT");
    expect(url).toContain("wind_speed_10m");
    expect(url).toContain("wind_gusts_10m");
    expect(url).toContain("wind_direction_10m");
    expect(url).toContain("temperature_2m");
    expect(url).toContain("precipitation");
    expect(url).toContain("cloud_cover");
  });

  test("throws a descriptive error on non-2xx response", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      text: async () => "Too Many Requests",
      json: async () => ({}),
    });
    const source = new OpenMeteoForecastSource(fetchImpl as unknown as typeof fetch);

    await expect(source.fetchHourly(52.5, 4.5, 3)).rejects.toThrow(/429/);
  });
});
