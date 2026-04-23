import type { ThresholdProfile } from "./types.js";

// Knots → m/s: 1 knot ≈ 0.5144 m/s. Values below are stored in SI.

// Beginner: 12–22 knots, conservative gust tolerance, no offshore, daylight only.
export const BEGINNER_THRESHOLDS: ThresholdProfile = {
  windMinMs: 6.2,                  // ~12 kn
  windMaxMs: 11.3,                 // ~22 kn
  gustMaxMs: 13.4,                 // ~26 kn
  directionsAllowed: "spot_default",
  airTempMinC: 10,
  waterTempMinC: 12,
  precipitationMaxMmPerHr: 1,
  tidePreference: "any",
  daylightOnly: true,
};

// Intermediate: 15–30 knots, moderate gust tolerance.
export const INTERMEDIATE_THRESHOLDS: ThresholdProfile = {
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

// Expert: 17–45 knots, wider gust tolerance, all spot-supported directions, cold-water OK.
export const EXPERT_THRESHOLDS: ThresholdProfile = {
  windMinMs: 8.7,                  // ~17 kn
  windMaxMs: 23.2,                 // ~45 kn
  gustMaxMs: 28.3,                 // ~55 kn
  directionsAllowed: "spot_default",
  airTempMinC: -5,
  waterTempMinC: null,             // don't care
  precipitationMaxMmPerHr: 10,
  tidePreference: "any",
  daylightOnly: false,
};

export const PRESETS = {
  beginner: BEGINNER_THRESHOLDS,
  intermediate: INTERMEDIATE_THRESHOLDS,
  expert: EXPERT_THRESHOLDS,
} as const;
