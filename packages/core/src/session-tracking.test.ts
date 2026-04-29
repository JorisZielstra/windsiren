import { describe, expect, it } from "vitest";
import {
  airtimeToJumpHeight,
  accelMagnitudeG,
  haversineMeters,
  JumpDetector,
} from "./session-tracking";

describe("airtimeToJumpHeight", () => {
  it("classic 1.4s airtime ≈ 2.4m jump", () => {
    expect(airtimeToJumpHeight(1.4)).toBeCloseTo(2.4, 1);
  });
  it("returns 0 for non-positive airtime", () => {
    expect(airtimeToJumpHeight(0)).toBe(0);
    expect(airtimeToJumpHeight(-1)).toBe(0);
  });
});

describe("accelMagnitudeG", () => {
  it("magnitude of resting phone (0,0,1)g = 1", () => {
    expect(accelMagnitudeG(0, 0, 1)).toBeCloseTo(1);
  });
  it("magnitude of 3-4-5 in any direction = 5", () => {
    expect(accelMagnitudeG(3, 4, 0)).toBeCloseTo(5);
  });
});

describe("haversineMeters", () => {
  it("one degree of latitude ≈ 111 km at the equator", () => {
    const m = haversineMeters(0, 0, 1, 0);
    expect(m).toBeGreaterThan(110_000);
    expect(m).toBeLessThan(112_000);
  });
  it("identical points = 0", () => {
    expect(haversineMeters(52, 4, 52, 4)).toBe(0);
  });
});

describe("JumpDetector", () => {
  function feed(detector: JumpDetector, samples: { mag: number; t: number }[]) {
    for (const s of samples) detector.push(s);
  }

  it("detects a clean 1.0s jump and reports ~1.23m height", () => {
    const jumps: { airtimeS: number; heightM: number }[] = [];
    const det = new JumpDetector((j) => jumps.push(j));
    feed(det, [
      { mag: 1.0, t: 0 },
      { mag: 1.0, t: 100 },
      // Takeoff at t=200ms (mag drops below 0.4)
      { mag: 0.2, t: 200 },
      { mag: 0.1, t: 400 },
      { mag: 0.1, t: 600 },
      { mag: 0.2, t: 800 },
      { mag: 0.2, t: 1000 },
      // Landing at t=1200ms (mag spikes above 1.6)
      { mag: 2.5, t: 1200 },
      { mag: 1.0, t: 1300 },
    ]);
    expect(jumps).toHaveLength(1);
    expect(jumps[0]!.airtimeS).toBeCloseTo(1.0, 1);
    // h = 9.81 * 1² / 8 ≈ 1.226
    expect(jumps[0]!.heightM).toBeCloseTo(1.23, 2);
  });

  it("ignores jumps shorter than minAirtimeS (0.5s default)", () => {
    const jumps: unknown[] = [];
    const det = new JumpDetector((j) => jumps.push(j));
    feed(det, [
      { mag: 1.0, t: 0 },
      { mag: 0.2, t: 100 }, // takeoff
      { mag: 2.0, t: 300 }, // landing 200ms later — below threshold
    ]);
    expect(jumps).toHaveLength(0);
  });

  it("ignores absurdly long airtime (likely glitch)", () => {
    const jumps: unknown[] = [];
    const det = new JumpDetector((j) => jumps.push(j));
    feed(det, [
      { mag: 1.0, t: 0 },
      { mag: 0.1, t: 100 }, // takeoff
      { mag: 2.0, t: 20_000 }, // landing 20s later
    ]);
    expect(jumps).toHaveLength(0);
  });

  it("detects two jumps in sequence", () => {
    const jumps: { airtimeS: number }[] = [];
    const det = new JumpDetector((j) => jumps.push(j));
    feed(det, [
      { mag: 1.0, t: 0 },
      { mag: 0.2, t: 200 }, // jump 1 takeoff
      { mag: 0.1, t: 700 },
      { mag: 2.0, t: 1000 }, // jump 1 landing (0.8s)
      { mag: 1.0, t: 1500 },
      { mag: 0.3, t: 2000 }, // jump 2 takeoff
      { mag: 0.2, t: 2400 },
      { mag: 1.8, t: 2700 }, // jump 2 landing (0.7s)
    ]);
    expect(jumps).toHaveLength(2);
    expect(jumps[0]!.airtimeS).toBeCloseTo(0.8, 1);
    expect(jumps[1]!.airtimeS).toBeCloseTo(0.7, 1);
  });
});
