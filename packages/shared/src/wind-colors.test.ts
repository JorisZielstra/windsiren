import { describe, test, expect } from "vitest";
import { windKnColor } from "./wind-colors";

describe("windKnColor", () => {
  test("0 kn renders transparent with neutral text", () => {
    expect(windKnColor(0)).toEqual({ bg: "transparent", fg: "#71717a" });
  });

  test("negative + NaN clamp to transparent", () => {
    expect(windKnColor(-5).bg).toBe("transparent");
    expect(windKnColor(NaN).bg).toBe("transparent");
  });

  test("hits the user's named reference points", () => {
    // Each stop should equal the picked Tailwind hex exactly (no lerp at
    // the boundary). These are the visual contract with the user.
    expect(windKnColor(10).bg.toLowerCase()).toBe("#7dd3fc"); // sky-300
    expect(windKnColor(15).bg.toLowerCase()).toBe("#86efac"); // green-300
    expect(windKnColor(20).bg.toLowerCase()).toBe("#fde047"); // yellow-300
    expect(windKnColor(25).bg.toLowerCase()).toBe("#fb923c"); // orange-400
    expect(windKnColor(30).bg.toLowerCase()).toBe("#ea580c"); // orange-600
    expect(windKnColor(35).bg.toLowerCase()).toBe("#b91c1c"); // red-700
    expect(windKnColor(40).bg.toLowerCase()).toBe("#6b21a8"); // purple-800
    expect(windKnColor(45).bg.toLowerCase()).toBe("#4c1d95"); // violet-900
  });

  test("interpolates between stops", () => {
    // 12.5 kn falls halfway between sky-300 and green-300 — neither hex.
    const mid = windKnColor(12.5).bg;
    expect(mid).not.toBe("#7dd3fc");
    expect(mid).not.toBe("#86efac");
    expect(mid).toMatch(/^#[0-9a-f]{6}$/);
  });

  test("clamps above the highest stop", () => {
    // 60 kn returns the same color as 45 kn (we don't extrapolate).
    expect(windKnColor(60).bg).toBe(windKnColor(45).bg);
  });

  test("text contrast flips dark→light at the warm bands", () => {
    // Light backgrounds get dark text; the dark warm/cool bands get white.
    expect(windKnColor(10).fg.toLowerCase()).toBe("#1f2937"); // light bg → dark fg
    expect(windKnColor(20).fg.toLowerCase()).toBe("#1f2937");
    expect(windKnColor(30).fg.toLowerCase()).toBe("#ffffff"); // dark bg → white fg
    expect(windKnColor(35).fg.toLowerCase()).toBe("#ffffff");
    expect(windKnColor(40).fg.toLowerCase()).toBe("#ffffff");
  });
});
