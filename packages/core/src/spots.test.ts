import { describe, test, expect } from "vitest";
import type { HourlyForecast } from "@windsiren/shared";
import type { SpotRow } from "@windsiren/supabase";
import {
  averageWindMs,
  dbRowToSpot,
  formatDayLabel,
  formatHourLabel,
  groupHoursByLocalDay,
  peakWindMs,
} from "./spots";

const BASE_ROW: SpotRow = {
  id: "abc",
  slug: "test",
  name: "Test Spot",
  country_code: "NL",
  lat: 52.5,
  lng: 4.5,
  safe_wind_directions: [{ from: 200, to: 320 }],
  tide_sensitive: true,
  hazards: "shallow at low tide",
  knmi_station_id: "06225",
  rws_tide_station_id: "IJMUIDEN",
  region: "north_holland",
  active: true,
  created_at: "2026-04-23T12:00:00Z",
  updated_at: "2026-04-23T12:00:00Z",
};

function makeHour(overrides: Partial<HourlyForecast> = {}): HourlyForecast {
  return {
    time: "2026-04-23T12:00:00Z",
    windSpeedMs: 10,
    gustMs: 14,
    windDirectionDeg: 270,
    airTempC: 15,
    waterTempC: 12,
    precipitationMm: 0,
    cloudCoveragePct: 30,
    ...overrides,
  };
}

describe("dbRowToSpot", () => {
  test("maps snake_case DB fields to camelCase domain fields", () => {
    const spot = dbRowToSpot(BASE_ROW);
    expect(spot.id).toBe("abc");
    expect(spot.countryCode).toBe("NL");
    expect(spot.tideSensitive).toBe(true);
    expect(spot.knmiStationId).toBe("06225");
    expect(spot.rwsTideStationId).toBe("IJMUIDEN");
  });

  test("coerces numeric string lat/lng to number", () => {
    // Supabase sometimes returns numeric columns as strings
    const row = { ...BASE_ROW, lat: "52.5" as unknown as number, lng: "4.5" as unknown as number };
    const spot = dbRowToSpot(row);
    expect(spot.lat).toBe(52.5);
    expect(spot.lng).toBe(4.5);
    expect(typeof spot.lat).toBe("number");
  });

  test("casts jsonb safe_wind_directions to DirectionRange[]", () => {
    const spot = dbRowToSpot(BASE_ROW);
    expect(spot.safeWindDirections).toEqual([{ from: 200, to: 320 }]);
  });
});

describe("averageWindMs / peakWindMs", () => {
  test("averageWindMs returns arithmetic mean", () => {
    const hours = [makeHour({ windSpeedMs: 10 }), makeHour({ windSpeedMs: 20 })];
    expect(averageWindMs(hours)).toBe(15);
  });

  test("peakWindMs returns the maximum", () => {
    const hours = [
      makeHour({ windSpeedMs: 10 }),
      makeHour({ windSpeedMs: 20 }),
      makeHour({ windSpeedMs: 5 }),
    ];
    expect(peakWindMs(hours)).toBe(20);
  });

  test("both return null for empty input", () => {
    expect(averageWindMs([])).toBeNull();
    expect(peakWindMs([])).toBeNull();
  });
});

describe("groupHoursByLocalDay", () => {
  test("groups by NL local calendar date, not UTC date", () => {
    // 23:30 UTC in April 2026 is 01:30 CEST → the NEXT day in NL
    const hours = [
      makeHour({ time: "2026-04-23T21:00:00Z" }), // 23:00 CEST, still 23 Apr NL
      makeHour({ time: "2026-04-23T23:30:00Z" }), // 01:30 CEST, 24 Apr NL
      makeHour({ time: "2026-04-24T00:30:00Z" }), // 02:30 CEST, 24 Apr NL
    ];
    const groups = groupHoursByLocalDay(hours);
    expect(groups.length).toBe(2);
    expect(groups[0]?.dateKey).toBe("2026-04-23");
    expect(groups[0]?.hours).toHaveLength(1);
    expect(groups[1]?.dateKey).toBe("2026-04-24");
    expect(groups[1]?.hours).toHaveLength(2);
  });

  test("returns empty array for empty input", () => {
    expect(groupHoursByLocalDay([])).toEqual([]);
  });
});

describe("formatDayLabel / formatHourLabel", () => {
  test("formatDayLabel renders a human-readable NL-locale label", () => {
    const label = formatDayLabel("2026-04-23");
    expect(label).toMatch(/Apr/);
    expect(label).toMatch(/23/);
  });

  test("formatHourLabel renders 24h NL local time", () => {
    const label = formatHourLabel("2026-04-23T10:00:00Z"); // 12:00 CEST
    expect(label).toBe("12:00");
  });
});
