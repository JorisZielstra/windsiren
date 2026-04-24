import type { ThresholdProfile } from "./types";

// Single default threshold profile used for all public verdicts while
// per-user personalization is not yet shipped. Values were previously
// labeled "intermediate preset" (15–30 kn, moderate gust tolerance,
// spot-default directions, mild-weather cutoffs).
//
// When personalization lands, each user's stored thresholds override this.
// Knots → m/s: 1 kn ≈ 0.5144 m/s.
export const DEFAULT_THRESHOLDS: ThresholdProfile = {
  windMinMs: 7.7,                  // ~15 kn
  windMaxMs: 15.4,                 // ~30 kn
  gustMaxMs: 18.0,                 // ~35 kn
  directionsAllowed: "spot_default",
  airTempMinC: 5,
  waterTempMinC: 8,
  precipitationMaxMmPerHr: 3,
  tidePreference: "any",
  daylightOnly: true,
};
