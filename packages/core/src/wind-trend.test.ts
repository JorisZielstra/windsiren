import { describe, test, expect } from "vitest";
import type { HourlyForecast } from "@windsiren/shared";
import { classifyWindTrend } from "./wind-trend";

// Helper: build a daylight hour at NL local hour `localHour` on 2026-04-26
// with a given wind speed. The Date is the UTC timestamp the API would
// return — for April in Amsterdam (CEST = UTC+2), local 10:00 == UTC 08:00.
function hour(localHour: number, windSpeedMs: number): HourlyForecast {
  const utcHour = localHour - 2; // CEST offset; close enough for a test fixture.
  const time = new Date(Date.UTC(2026, 3, 26, utcHour, 0, 0)).toISOString();
  return {
    time,
    windSpeedMs,
    gustMs: windSpeedMs * 1.3,
    windDirectionDeg: 240,
    airTempC: 14,
    waterTempC: null,
    precipitationMm: 0,
    cloudCoveragePct: 30,
  };
}

describe("classifyWindTrend", () => {
  test("returns 'holding' when fewer than 4 daylight hours are available", () => {
    expect(classifyWindTrend([])).toBe("holding");
    expect(
      classifyWindTrend([hour(10, 8), hour(11, 8), hour(12, 8)]),
    ).toBe("holding");
  });

  test("returns 'rising' when the second half averages > 1 m/s above the first", () => {
    const hours = [
      hour(8, 6), hour(9, 6.5), hour(10, 7), hour(11, 7),  // first half avg ~6.6
      hour(12, 9), hour(13, 9.5), hour(14, 10), hour(15, 10), // second half avg ~9.6
    ];
    expect(classifyWindTrend(hours)).toBe("rising");
  });

  test("returns 'dropping' when the second half averages > 1 m/s below the first", () => {
    const hours = [
      hour(8, 12), hour(9, 12), hour(10, 11), hour(11, 11),
      hour(12, 8), hour(13, 7.5), hour(14, 7), hour(15, 7),
    ];
    expect(classifyWindTrend(hours)).toBe("dropping");
  });

  test("returns 'holding' for sub-threshold drift", () => {
    const hours = [
      hour(8, 9), hour(9, 9), hour(10, 9.2), hour(11, 9.3),
      hour(12, 9.5), hour(13, 9.5), hour(14, 9.7), hour(15, 9.7),
    ];
    expect(classifyWindTrend(hours)).toBe("holding");
  });

  test("ignores hours outside the 08:00–20:00 daylight window", () => {
    // Pre-dawn and after-dark hours with wildly different speeds should
    // not influence the daylight trend classification.
    const hours = [
      hour(2, 30), hour(4, 30), hour(6, 30),  // before 08:00 — ignored
      hour(8, 6), hour(9, 6), hour(10, 6), hour(11, 6),
      hour(12, 12), hour(13, 12), hour(14, 12), hour(15, 12),
      hour(22, 0), hour(23, 0),  // after 20:00 — ignored
    ];
    expect(classifyWindTrend(hours)).toBe("rising");
  });
});
