// Core normalized types. All values in SI units; convert to knots/°F only at the UI edge.

export type HourlyForecast = {
  time: string;              // ISO 8601
  windSpeedMs: number;
  gustMs: number;
  windDirectionDeg: number;  // 0–359, meteorological — direction wind comes FROM
  airTempC: number;
  waterTempC: number | null;
  precipitationMm: number;   // mm in the preceding hour
  cloudCoveragePct: number;
};

export type Observation = {
  observedAt: string;        // ISO 8601
  stationId: string;
  windSpeedMs: number;
  gustMs: number;
  windDirectionDeg: number;
  airTempC: number | null;
  waterTempC: number | null;
  precipitationMm: number | null;
  pressureHpa: number | null;
};

export type TidePoint = {
  at: string;                // ISO 8601
  type: "high" | "low";
  heightCm: number;
};

export type DirectionRange = {
  from: number;              // 0–359
  to: number;                // 0–359. If to < from, the range wraps through 0°.
};

export type Spot = {
  id: string;
  slug: string;
  name: string;
  countryCode: string;
  lat: number;
  lng: number;
  safeWindDirections: DirectionRange[];
  tideSensitive: boolean;
  hazards: string | null;
  knmiStationId: string | null;
  rwsTideStationId: string | null;
};

export type StationInfo = {
  id: string;
  name: string;
  lat: number;
  lng: number;
};

// User's thresholds — same shape for presets and personalized mode.
export type ThresholdProfile = {
  windMinMs: number;
  windMaxMs: number;
  gustMaxMs: number;
  // "spot_default" means: trust the spot's safeWindDirections.
  // An explicit array overrides the spot's default.
  directionsAllowed: "spot_default" | DirectionRange[];
  airTempMinC: number;
  waterTempMinC: number | null;   // null = don't care about water temp
  precipitationMaxMmPerHr: number;
  tidePreference: "any" | "mid" | "rising" | "falling";
  daylightOnly: boolean;
};

export type ProfileMode = "beginner" | "intermediate" | "expert" | "personalized";

export type VerdictReason = {
  metric: string;                  // e.g. "wind_speed", "gust", "direction"
  passed: boolean;
  actual: number | string;
  threshold: number | string;
};

export type Verdict = {
  decision: "go" | "no_go" | "marginal";
  reasons: VerdictReason[];
};
