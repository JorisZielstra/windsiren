import { describe, test, expect } from "vitest";
import { getSunTimes } from "./sun-times";

// Reference values from timeanddate.com (NOAA-equivalent) for Amsterdam
// (52.37°N, 4.90°E). Times are UTC. We tolerate ±3 minutes since the
// approximation algorithm trades precision for a no-deps implementation
// and we're using nominal CET/CEST offsets in the references.
const AMS_LAT = 52.37;
const AMS_LNG = 4.90;
const TOL_MS = 3 * 60 * 1000;

function expectClose(actual: Date, expectedUtc: string) {
  const expected = new Date(expectedUtc).getTime();
  const diff = Math.abs(actual.getTime() - expected);
  expect(diff).toBeLessThanOrEqual(TOL_MS);
}

describe("getSunTimes — Amsterdam reference values", () => {
  test("June 21 2026 (summer solstice): sunrise ~03:18 UTC, sunset ~20:06 UTC", () => {
    const date = new Date(Date.UTC(2026, 5, 21, 12, 0, 0));
    const { sunrise, sunset } = getSunTimes(AMS_LAT, AMS_LNG, date);
    expectClose(sunrise, "2026-06-21T03:18:00Z");
    expectClose(sunset, "2026-06-21T20:06:00Z");
  });

  test("December 21 2026 (winter solstice): sunrise ~07:46 UTC, sunset ~15:29 UTC", () => {
    const date = new Date(Date.UTC(2026, 11, 21, 12, 0, 0));
    const { sunrise, sunset } = getSunTimes(AMS_LAT, AMS_LNG, date);
    expectClose(sunrise, "2026-12-21T07:46:00Z");
    expectClose(sunset, "2026-12-21T15:29:00Z");
  });

  test("March 20 2026 (spring equinox): roughly 12 hours of daylight", () => {
    const date = new Date(Date.UTC(2026, 2, 20, 12, 0, 0));
    const { sunrise, sunset } = getSunTimes(AMS_LAT, AMS_LNG, date);
    const daylightMs = sunset.getTime() - sunrise.getTime();
    const daylightHours = daylightMs / (60 * 60 * 1000);
    expect(daylightHours).toBeGreaterThan(11.8);
    expect(daylightHours).toBeLessThan(12.4);
  });
});

describe("getSunTimes — edge cases", () => {
  test("polar latitude in midwinter clamps to safe values (no NaN)", () => {
    // 75°N in late December: sun never rises. Algorithm clamps to noon.
    const date = new Date(Date.UTC(2026, 11, 21, 12, 0, 0));
    const { sunrise, sunset } = getSunTimes(75, 0, date);
    expect(Number.isFinite(sunrise.getTime())).toBe(true);
    expect(Number.isFinite(sunset.getTime())).toBe(true);
  });
});
