import { describe, test, expect } from "vitest";
import type { HourlyForecast, Spot } from "@windsiren/shared";
import { partitionByDay } from "./day-verdicts";

const SPOT: Spot = {
  id: "s1",
  slug: "wijk",
  name: "Wijk aan Zee",
  countryCode: "NL",
  lat: 52.49,
  lng: 4.59,
  // Allow all directions so the threshold logic doesn't make our test
  // fragile to the spot's safe-direction config.
  safeWindDirections: [{ from: 0, to: 359 }],
  tideSensitive: false,
  hazards: null,
  knmiStationId: null,
  rwsTideStationId: null,
  region: null,
};

// Build a daylight hour at NL local hour `localHour` on the given date
// with given wind speed. Date is the UTC timestamp the API would return —
// for April in Amsterdam (CEST = UTC+2), local 10:00 == UTC 08:00.
function hour(
  ymd: [number, number, number],
  localHour: number,
  windSpeedMs: number,
): HourlyForecast {
  const [y, m, d] = ymd;
  const utcHour = localHour - 2;
  const time = new Date(Date.UTC(y, m - 1, d, utcHour, 0, 0)).toISOString();
  return {
    time,
    windSpeedMs,
    gustMs: windSpeedMs * 1.2,
    windDirectionDeg: 240,
    airTempC: 14,
    // Pass the DEFAULT_THRESHOLDS waterTempMinC=8 check (which fails-closed
    // on null). This isolates the test to wind/direction logic.
    waterTempC: 14,
    precipitationMm: 0,
    cloudCoveragePct: 30,
  };
}

describe("partitionByDay", () => {
  test("returns empty array for empty hours input", () => {
    expect(partitionByDay(SPOT, [])).toEqual([]);
  });

  test("groups hours by NL local date and preserves insertion order", () => {
    const hours = [
      hour([2026, 4, 26], 10, 10),
      hour([2026, 4, 26], 14, 12),
      hour([2026, 4, 27], 10, 8),
      hour([2026, 4, 28], 10, 6),
    ];
    const result = partitionByDay(SPOT, hours);
    expect(result).toHaveLength(3);
    expect(result.map((d) => d.dateKey)).toEqual([
      "2026-04-26",
      "2026-04-27",
      "2026-04-28",
    ]);
    expect(result[0]!.hours).toHaveLength(2);
    expect(result[1]!.hours).toHaveLength(1);
  });

  test("runs the decision engine per day — strong wind day is GO, weak is NO_GO", () => {
    // Day 1: 4 daylight hours of solid 10 m/s wind → should pass the
    // 3-rideable-hours threshold for GO. Day 2: same hours at 3 m/s →
    // below the wind minimum, so no_go.
    const hours = [
      hour([2026, 4, 26], 10, 10),
      hour([2026, 4, 26], 12, 11),
      hour([2026, 4, 26], 14, 11),
      hour([2026, 4, 26], 16, 10),
      hour([2026, 4, 27], 10, 3),
      hour([2026, 4, 27], 12, 3),
      hour([2026, 4, 27], 14, 3),
      hour([2026, 4, 27], 16, 3),
    ];
    const result = partitionByDay(SPOT, hours);
    expect(result[0]!.verdict?.decision).toBe("go");
    expect(result[1]!.verdict?.decision).toBe("no_go");
  });
});
