import { describe, expect, test } from "vitest";
import {
  angleDiff,
  blendForecasts,
  classifySpot,
  medianAngle,
  modelsForSpot,
} from "./blend";

// Blend unit tests — all logic is pure, no network. The bigger
// integration story (parallel fetches + caching) lives in open-meteo.test.ts.

describe("classifySpot", () => {
  test("Wadden coast → Zone A", () => {
    expect(classifySpot(53.0814, 4.7361)).toBe("A"); // Paal 17 Texel
    expect(classifySpot(53.167, 4.875)).toBe("A");   // Waddenzee Texel
  });

  test("Central NL coast → Zone B", () => {
    expect(classifySpot(52.4928, 4.6037)).toBe("B"); // Wijk aan Zee
    expect(classifySpot(52.1083, 4.2735)).toBe("B"); // Scheveningen
  });

  test("Zeeland → Zone C", () => {
    expect(classifySpot(51.7556, 3.85)).toBe("C"); // Brouwersdam
  });

  test("Inland lakes (lng ≥ 5°) → Zone D", () => {
    expect(classifySpot(52.9678, 5.4114)).toBe("D"); // Workum
    expect(classifySpot(52.7396, 5.177)).toBe("D");  // Andijk
  });

  test("boundary lat = 53.0 → Zone A (≥)", () => {
    expect(classifySpot(53.0, 4.5)).toBe("A");
  });

  test("boundary lat = 52.0 → Zone B (≥)", () => {
    expect(classifySpot(52.0, 4.5)).toBe("B");
  });
});

describe("modelsForSpot", () => {
  test("Zone A includes MET Nordic, not AROME France", () => {
    const models = modelsForSpot(53.167, 4.875);
    expect(models).toContain("metno_seamless");
    expect(models).toContain("gfs_seamless");
    expect(models).not.toContain("meteofrance_arome_france");
  });

  test("Zone B includes AROME France, not MET Nordic", () => {
    const models = modelsForSpot(52.4928, 4.6037);
    expect(models).toContain("meteofrance_arome_france");
    expect(models).toContain("gfs_seamless");
    expect(models).not.toContain("metno_seamless");
  });

  test("Zone D includes ICON-D2, not AROME France", () => {
    const models = modelsForSpot(52.9678, 5.4114);
    expect(models).toContain("icon_d2");
    expect(models).not.toContain("meteofrance_arome_france");
    expect(models).not.toContain("metno_seamless");
  });
});

// Helper to build a synthetic forecast hour for tests.
function hour(time: string, w: number, g: number, dir = 75) {
  return {
    time,
    windSpeedMs: w,
    gustMs: g,
    windDirectionDeg: dir,
    airTempC: 12,
    waterTempC: null,
    precipitationMm: 0,
    cloudCoveragePct: 50,
  };
}

describe("blendForecasts", () => {
  test("empty input → empty output", () => {
    expect(blendForecasts([])).toEqual([]);
  });

  test("single model → identity blend", () => {
    const out = blendForecasts([
      { modelId: "gfs_seamless", hours: [hour("2026-04-29T12:00Z", 10, 14)] },
    ]);
    expect(out).toHaveLength(1);
    expect(out[0]!.windSpeedMs).toBe(10);
    expect(out[0]!.gustMs).toBe(14);
  });

  test("mean-blends wind speed across models", () => {
    const out = blendForecasts([
      { modelId: "gfs_seamless",            hours: [hour("2026-04-29T12:00Z", 10, 15)] },
      { modelId: "meteofrance_arome_france", hours: [hour("2026-04-29T12:00Z", 8, 12)] },
    ]);
    expect(out[0]!.windSpeedMs).toBe(9); // mean of 10 and 8
  });

  test("max-aggregates gust across models", () => {
    const out = blendForecasts([
      { modelId: "gfs_seamless", hours: [hour("2026-04-29T12:00Z", 10, 15, 75)] },
      { modelId: "metno_seamless", hours: [hour("2026-04-29T12:00Z", 12, 18, 75)] },
    ]);
    // metno's gust is the max here AND it's not AROME so no cap applies.
    expect(out[0]!.gustMs).toBe(18);
  });

  test("AROME-FR gust capped at 1.4× GFS gust (dawn-spike fix)", () => {
    const out = blendForecasts([
      { modelId: "gfs_seamless", hours: [hour("2026-04-29T08:00Z", 12, 15, 75)] },
      { modelId: "meteofrance_arome_france", hours: [hour("2026-04-29T08:00Z", 14, 30, 75)] },
    ]);
    // GFS gust 15 → cap = 21. AROME's raw gust 30 capped to 21.
    // Final max gust between GFS 15 and capped AROME 21 = 21.
    expect(out[0]!.gustMs).toBe(21);
  });

  test("AROME cap doesn't fire when GFS gust is missing", () => {
    const out = blendForecasts([
      // Only AROME present — no GFS anchor available for capping.
      { modelId: "meteofrance_arome_france", hours: [hour("2026-04-29T08:00Z", 14, 30, 75)] },
    ]);
    expect(out[0]!.gustMs).toBe(30); // raw value, no cap applied
  });

  test("drops models with direction more than 30° off the median", () => {
    const out = blendForecasts([
      { modelId: "gfs_seamless",            hours: [hour("2026-04-29T12:00Z", 10, 15, 75)] },
      { modelId: "meteofrance_arome_france", hours: [hour("2026-04-29T12:00Z", 11, 16, 80)] },
      { modelId: "ecmwf_aifs025",            hours: [hour("2026-04-29T12:00Z", 30, 40, 200)] },
      // ECMWF says wind from south, others from east — totally different
      // synoptic flow. Should be dropped, not averaged in.
    ]);
    // Mean of GFS 10 + AROME 11 = 10.5, NOT (10+11+30)/3 = 17.
    expect(out[0]!.windSpeedMs).toBe(10.5);
  });

  test("preserves all models when only one is present (no spurious dropping)", () => {
    // Single-model hours should never be dropped on direction (there's
    // no median to compare against, and we'd starve the blend).
    const out = blendForecasts([
      { modelId: "gfs_seamless", hours: [hour("2026-04-29T12:00Z", 10, 15, 200)] },
    ]);
    expect(out).toHaveLength(1);
    expect(out[0]!.windSpeedMs).toBe(10);
  });

  test("merges hours from models with different horizons", () => {
    // AROME (4-day horizon) only covers t=12:00. GFS (16-day) covers
    // both 12:00 and 96:00. Result should have both timestamps; AROME
    // contributes only to 12:00.
    const out = blendForecasts([
      {
        modelId: "gfs_seamless",
        hours: [
          hour("2026-04-29T12:00Z", 10, 15),
          hour("2026-05-03T12:00Z", 14, 20),
        ],
      },
      {
        modelId: "meteofrance_arome_france",
        hours: [hour("2026-04-29T12:00Z", 12, 16)],
      },
    ]);
    expect(out).toHaveLength(2);
    // 12:00 — blend of GFS 10 and AROME 12 = 11
    expect(out[0]!.windSpeedMs).toBe(11);
    // Day 4 — only GFS, identity
    expect(out[1]!.windSpeedMs).toBe(14);
  });

  test("waterTempC is always null (these endpoints don't expose it)", () => {
    const out = blendForecasts([
      { modelId: "gfs_seamless", hours: [hour("2026-04-29T12:00Z", 10, 15)] },
    ]);
    expect(out[0]!.waterTempC).toBeNull();
  });
});

describe("medianAngle", () => {
  test("simple mean of nearby angles", () => {
    expect(medianAngle([70, 80])).toBeCloseTo(75, 0);
  });

  test("handles 0°/360° wrap (mean of 350 and 10 is 0, not 180)", () => {
    expect(medianAngle([350, 10])).toBeCloseTo(0, 0);
  });

  test("empty input → 0", () => {
    expect(medianAngle([])).toBe(0);
  });
});

describe("angleDiff", () => {
  test("nearby angles", () => {
    expect(angleDiff(70, 80)).toBe(10);
  });

  test("wraps shorter way", () => {
    expect(angleDiff(350, 10)).toBe(20);
  });

  test("symmetric", () => {
    expect(angleDiff(45, 200)).toBe(angleDiff(200, 45));
  });
});
