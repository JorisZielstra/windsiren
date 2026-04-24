import { describe, test, expect } from "vitest";
import {
  normalizeDeg,
  polarToCartesian,
  sectorPath,
  cardinalLabelPositions,
  safeSectorPaths,
} from "./wind-rose";

describe("polarToCartesian", () => {
  test("0° is straight up (north)", () => {
    const p = polarToCartesian(50, 50, 40, 0);
    expect(p.x).toBeCloseTo(50, 5);
    expect(p.y).toBeCloseTo(10, 5); // cy - r
  });

  test("90° is right (east)", () => {
    const p = polarToCartesian(50, 50, 40, 90);
    expect(p.x).toBeCloseTo(90, 5); // cx + r
    expect(p.y).toBeCloseTo(50, 5);
  });

  test("180° is down (south)", () => {
    const p = polarToCartesian(50, 50, 40, 180);
    expect(p.x).toBeCloseTo(50, 5);
    expect(p.y).toBeCloseTo(90, 5); // cy + r
  });

  test("270° is left (west)", () => {
    const p = polarToCartesian(50, 50, 40, 270);
    expect(p.x).toBeCloseTo(10, 5); // cx - r
    expect(p.y).toBeCloseTo(50, 5);
  });
});

describe("normalizeDeg", () => {
  test("in-range values pass through", () => {
    expect(normalizeDeg(0)).toBe(0);
    expect(normalizeDeg(180)).toBe(180);
    expect(normalizeDeg(359)).toBe(359);
  });

  test("negative values wrap", () => {
    expect(normalizeDeg(-90)).toBe(270);
    expect(normalizeDeg(-1)).toBe(359);
  });

  test("values over 360 wrap", () => {
    expect(normalizeDeg(360)).toBe(0);
    expect(normalizeDeg(450)).toBe(90);
    expect(normalizeDeg(721)).toBe(1);
  });
});

describe("sectorPath", () => {
  test("normal sector uses small arc flag when sweep <= 180°", () => {
    const path = sectorPath(50, 50, 40, 90, 180); // 90° sweep
    expect(path).toContain("A 40 40 0 0 1"); // largeArcFlag = 0
  });

  test("wide sector uses large arc flag when sweep > 180°", () => {
    const path = sectorPath(50, 50, 40, 90, 270 + 1); // 181° sweep
    expect(path).toContain("A 40 40 0 1 1"); // largeArcFlag = 1
  });

  test("wrapping sector (toDeg < fromDeg) computes sweep through 360°", () => {
    // 340° -> 40° is a 60° sweep through north, not a 300° counter-clockwise sweep.
    const path = sectorPath(50, 50, 40, 340, 40);
    expect(path).toContain("A 40 40 0 0 1"); // 60° < 180° → small arc
  });

  test("zero-width sector collapses to a full circle", () => {
    const path = sectorPath(50, 50, 40, 100, 100);
    // Full-circle path starts at (cx - r, cy) and uses two 180° arcs.
    expect(path).toMatch(/M 10 50/);
  });

  test("path starts and ends with expected commands", () => {
    const path = sectorPath(50, 50, 40, 0, 90);
    expect(path.startsWith("M 50 50")).toBe(true); // center
    expect(path.trim().endsWith("Z")).toBe(true);
  });
});

describe("safeSectorPaths", () => {
  test("returns one path per range", () => {
    const paths = safeSectorPaths(50, 50, 40, [
      { from: 200, to: 320 },
      { from: 30, to: 80 },
    ]);
    expect(paths).toHaveLength(2);
    for (const p of paths) {
      expect(p.startsWith("M 50 50")).toBe(true);
    }
  });

  test("returns empty array when no ranges", () => {
    expect(safeSectorPaths(50, 50, 40, [])).toEqual([]);
  });
});

describe("cardinalLabelPositions", () => {
  test("places N E S W at compass points", () => {
    const p = cardinalLabelPositions(50, 50, 40);
    expect(p.N.y).toBeCloseTo(10, 5);
    expect(p.E.x).toBeCloseTo(90, 5);
    expect(p.S.y).toBeCloseTo(90, 5);
    expect(p.W.x).toBeCloseTo(10, 5);
  });
});
