import { describe, test, expect } from "vitest";
import {
  evaluateDay,
  directionInAnyRange,
  type EvaluateInput,
} from "./decision-engine";
import type { HourlyForecast, Spot, ThresholdProfile } from "./types";

const BASE_SPOT: Spot = {
  id: "test-spot",
  slug: "test",
  name: "Test Spot",
  countryCode: "NL",
  lat: 52.5,
  lng: 4.5,
  safeWindDirections: [{ from: 200, to: 320 }], // SW → W → NW
  tideSensitive: false,
  hazards: null,
  knmiStationId: null,
  rwsTideStationId: null,
  region: null,
};

const BASE_THRESHOLDS: ThresholdProfile = {
  windMinMs: 7.7, // ~15 kn
  windMaxMs: 15.4, // ~30 kn
  gustMaxMs: 18.0, // ~35 kn
  directionsAllowed: "spot_default",
  airTempMinC: 5,
  waterTempMinC: null,
  precipitationMaxMmPerHr: 3,
  tidePreference: "any",
  daylightOnly: true,
};

// Baseline hour with every metric inside thresholds — used as a starting point.
const OK_HOUR: HourlyForecast = {
  time: "2026-04-23T12:00:00Z",
  windSpeedMs: 10,
  gustMs: 14,
  windDirectionDeg: 270,
  airTempC: 15,
  waterTempC: 12,
  precipitationMm: 0,
  cloudCoveragePct: 30,
};

function buildInput(overrides: Partial<EvaluateInput> = {}): EvaluateInput {
  return {
    spot: BASE_SPOT,
    hours: Array.from({ length: 6 }, () => ({ ...OK_HOUR })),
    thresholds: BASE_THRESHOLDS,
    ...overrides,
  };
}

describe("evaluateDay — rideable-hours aggregation", () => {
  test("returns go when all 6 hours pass", () => {
    expect(evaluateDay(buildInput()).decision).toBe("go");
  });

  test("returns go when exactly 3 hours pass", () => {
    const hours = Array.from({ length: 6 }, (_, i) => ({
      ...OK_HOUR,
      windSpeedMs: i < 3 ? 10 : 3,
    }));
    expect(evaluateDay(buildInput({ hours })).decision).toBe("go");
  });

  test("returns marginal when 1 hour passes", () => {
    const hours = Array.from({ length: 6 }, (_, i) => ({
      ...OK_HOUR,
      windSpeedMs: i === 0 ? 10 : 3,
    }));
    expect(evaluateDay(buildInput({ hours })).decision).toBe("marginal");
  });

  test("returns marginal when 2 hours pass", () => {
    const hours = Array.from({ length: 6 }, (_, i) => ({
      ...OK_HOUR,
      windSpeedMs: i < 2 ? 10 : 3,
    }));
    expect(evaluateDay(buildInput({ hours })).decision).toBe("marginal");
  });

  test("returns no_go when zero hours pass", () => {
    const hours = Array.from({ length: 6 }, () => ({
      ...OK_HOUR,
      windSpeedMs: 3,
    }));
    expect(evaluateDay(buildInput({ hours })).decision).toBe("no_go");
  });

  test("returns no_go with data reason for empty hours array", () => {
    const verdict = evaluateDay(buildInput({ hours: [] }));
    expect(verdict.decision).toBe("no_go");
    expect(verdict.reasons[0]?.metric).toBe("data");
  });
});

describe("evaluateDay — wind speed thresholds", () => {
  test("fails below windMinMs", () => {
    const hours = Array.from({ length: 6 }, () => ({
      ...OK_HOUR,
      windSpeedMs: BASE_THRESHOLDS.windMinMs - 0.5,
    }));
    expect(evaluateDay(buildInput({ hours })).decision).toBe("no_go");
  });

  test("fails above windMaxMs", () => {
    const hours = Array.from({ length: 6 }, () => ({
      ...OK_HOUR,
      windSpeedMs: BASE_THRESHOLDS.windMaxMs + 0.5,
    }));
    expect(evaluateDay(buildInput({ hours })).decision).toBe("no_go");
  });

  test("passes exactly at windMinMs (boundary inclusive)", () => {
    const hours = Array.from({ length: 6 }, () => ({
      ...OK_HOUR,
      windSpeedMs: BASE_THRESHOLDS.windMinMs,
    }));
    expect(evaluateDay(buildInput({ hours })).decision).toBe("go");
  });

  test("passes exactly at windMaxMs (boundary inclusive)", () => {
    const hours = Array.from({ length: 6 }, () => ({
      ...OK_HOUR,
      windSpeedMs: BASE_THRESHOLDS.windMaxMs,
    }));
    expect(evaluateDay(buildInput({ hours })).decision).toBe("go");
  });
});

describe("evaluateDay — gust threshold", () => {
  test("fails when gustMs exceeds gustMaxMs", () => {
    const hours = Array.from({ length: 6 }, () => ({
      ...OK_HOUR,
      gustMs: BASE_THRESHOLDS.gustMaxMs + 0.5,
    }));
    expect(evaluateDay(buildInput({ hours })).decision).toBe("no_go");
  });
});

describe("evaluateDay — direction checks", () => {
  test("passes when direction is within spot's safe range", () => {
    const hours = Array.from({ length: 6 }, () => ({
      ...OK_HOUR,
      windDirectionDeg: 250,
    }));
    expect(evaluateDay(buildInput({ hours })).decision).toBe("go");
  });

  test("fails when direction is outside spot's safe range", () => {
    const hours = Array.from({ length: 6 }, () => ({
      ...OK_HOUR,
      windDirectionDeg: 50,
    }));
    expect(evaluateDay(buildInput({ hours })).decision).toBe("no_go");
  });

  test("uses override array when directionsAllowed is explicit", () => {
    const thresholds: ThresholdProfile = {
      ...BASE_THRESHOLDS,
      directionsAllowed: [{ from: 0, to: 90 }],
    };
    const hours = Array.from({ length: 6 }, () => ({
      ...OK_HOUR,
      windDirectionDeg: 45,
    }));
    expect(evaluateDay(buildInput({ hours, thresholds })).decision).toBe("go");
  });

  test("override array rejects directions outside its ranges", () => {
    const thresholds: ThresholdProfile = {
      ...BASE_THRESHOLDS,
      directionsAllowed: [{ from: 0, to: 90 }],
    };
    const hours = Array.from({ length: 6 }, () => ({
      ...OK_HOUR,
      windDirectionDeg: 270,
    }));
    expect(evaluateDay(buildInput({ hours, thresholds })).decision).toBe("no_go");
  });
});

describe("evaluateDay — temperature & fail-closed semantics", () => {
  test("fails when air temp below airTempMinC", () => {
    const hours = Array.from({ length: 6 }, () => ({
      ...OK_HOUR,
      airTempC: BASE_THRESHOLDS.airTempMinC - 0.1,
    }));
    expect(evaluateDay(buildInput({ hours })).decision).toBe("no_go");
  });

  test("ignores water temp when waterTempMinC is null", () => {
    const hours = Array.from({ length: 6 }, () => ({
      ...OK_HOUR,
      waterTempC: 0,
    }));
    expect(evaluateDay(buildInput({ hours })).decision).toBe("go");
  });

  test("SAFETY: fails closed when waterTempMinC set but hour.waterTempC is null", () => {
    const thresholds: ThresholdProfile = { ...BASE_THRESHOLDS, waterTempMinC: 10 };
    const hours = Array.from({ length: 6 }, () => ({ ...OK_HOUR, waterTempC: null }));
    expect(evaluateDay(buildInput({ hours, thresholds })).decision).toBe("no_go");
  });

  test("fails when waterTempC below waterTempMinC", () => {
    const thresholds: ThresholdProfile = { ...BASE_THRESHOLDS, waterTempMinC: 12 };
    const hours = Array.from({ length: 6 }, () => ({ ...OK_HOUR, waterTempC: 8 }));
    expect(evaluateDay(buildInput({ hours, thresholds })).decision).toBe("no_go");
  });
});

describe("evaluateDay — precipitation", () => {
  test("fails when precipitation exceeds threshold", () => {
    const hours = Array.from({ length: 6 }, () => ({
      ...OK_HOUR,
      precipitationMm: BASE_THRESHOLDS.precipitationMaxMmPerHr + 0.5,
    }));
    expect(evaluateDay(buildInput({ hours })).decision).toBe("no_go");
  });
});

describe("evaluateDay — verdict reasons are explainable", () => {
  test("no_go verdict includes the failing metric in reasons", () => {
    const hours = Array.from({ length: 6 }, () => ({
      ...OK_HOUR,
      windSpeedMs: 3,
    }));
    const verdict = evaluateDay(buildInput({ hours }));
    expect(verdict.decision).toBe("no_go");
    expect(verdict.reasons.some((r) => r.metric === "wind_speed" && !r.passed)).toBe(true);
  });

  test("marginal verdict reports rideable_hours count", () => {
    const hours = Array.from({ length: 6 }, (_, i) => ({
      ...OK_HOUR,
      windSpeedMs: i < 2 ? 10 : 3,
    }));
    const verdict = evaluateDay(buildInput({ hours }));
    expect(verdict.decision).toBe("marginal");
    expect(verdict.reasons.some((r) => r.metric === "rideable_hours" && r.actual === 2)).toBe(
      true,
    );
  });
});

describe("directionInAnyRange", () => {
  test("returns true for direction within a simple range", () => {
    expect(directionInAnyRange(250, [{ from: 200, to: 320 }])).toBe(true);
  });

  test("returns false for direction outside all ranges", () => {
    expect(directionInAnyRange(100, [{ from: 200, to: 320 }])).toBe(false);
  });

  test("handles wrap-around range (340° → 0° → 40°)", () => {
    const range = [{ from: 340, to: 40 }];
    expect(directionInAnyRange(350, range)).toBe(true);
    expect(directionInAnyRange(10, range)).toBe(true);
    expect(directionInAnyRange(40, range)).toBe(true);
    expect(directionInAnyRange(340, range)).toBe(true);
    expect(directionInAnyRange(180, range)).toBe(false);
    expect(directionInAnyRange(41, range)).toBe(false);
    expect(directionInAnyRange(339, range)).toBe(false);
  });

  test("normalizes out-of-range degrees", () => {
    expect(directionInAnyRange(610, [{ from: 200, to: 320 }])).toBe(true); // 610 mod 360 = 250
    expect(directionInAnyRange(-90, [{ from: 200, to: 320 }])).toBe(true); // -90 + 360 = 270
  });

  test("empty ranges array returns false", () => {
    expect(directionInAnyRange(180, [])).toBe(false);
  });

  test("boundary inclusive for non-wrapping range", () => {
    expect(directionInAnyRange(200, [{ from: 200, to: 320 }])).toBe(true);
    expect(directionInAnyRange(320, [{ from: 200, to: 320 }])).toBe(true);
    expect(directionInAnyRange(199, [{ from: 200, to: 320 }])).toBe(false);
    expect(directionInAnyRange(321, [{ from: 200, to: 320 }])).toBe(false);
  });
});
