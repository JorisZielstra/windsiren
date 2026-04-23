import type {
  DirectionRange,
  HourlyForecast,
  Spot,
  ThresholdProfile,
  Verdict,
  VerdictReason,
} from "./types";

// Pure function. Takes normalized data + user thresholds, returns a verdict.
// No I/O, no provider knowledge, no global state. Fully testable.

export type EvaluateInput = {
  spot: Spot;
  hours: HourlyForecast[];
  thresholds: ThresholdProfile;
  // Future inputs: tide events, sunrise/sunset times for daylightOnly check.
};

export function evaluateDay(input: EvaluateInput): Verdict {
  const { spot, hours, thresholds } = input;

  if (hours.length === 0) {
    return {
      decision: "no_go",
      reasons: [
        { metric: "data", passed: false, actual: "no_hours", threshold: "at_least_one_hour" },
      ],
    };
  }

  // Bias toward no_go when data is missing or uncertain (safety gate).
  const allowedDirections: DirectionRange[] =
    thresholds.directionsAllowed === "spot_default"
      ? spot.safeWindDirections
      : thresholds.directionsAllowed;

  let rideableHours = 0;
  let firstFailure: VerdictReason | null = null;

  for (const hour of hours) {
    const hourReasons = evaluateHour(hour, thresholds, allowedDirections);
    const failed = hourReasons.find((r) => !r.passed);
    if (failed) {
      if (!firstFailure) firstFailure = failed;
    } else {
      rideableHours++;
    }
  }

  if (rideableHours >= 3) {
    return {
      decision: "go",
      reasons: [
        { metric: "rideable_hours", passed: true, actual: rideableHours, threshold: 3 },
      ],
    };
  }

  if (rideableHours >= 1) {
    return {
      decision: "marginal",
      reasons: firstFailure
        ? [
            { metric: "rideable_hours", passed: false, actual: rideableHours, threshold: 3 },
            firstFailure,
          ]
        : [{ metric: "rideable_hours", passed: false, actual: rideableHours, threshold: 3 }],
    };
  }

  return {
    decision: "no_go",
    reasons: firstFailure ? [firstFailure] : [],
  };
}

function evaluateHour(
  hour: HourlyForecast,
  thresholds: ThresholdProfile,
  allowedDirections: DirectionRange[],
): VerdictReason[] {
  const reasons: VerdictReason[] = [];

  reasons.push({
    metric: "wind_speed",
    passed: hour.windSpeedMs >= thresholds.windMinMs && hour.windSpeedMs <= thresholds.windMaxMs,
    actual: round(hour.windSpeedMs, 1),
    threshold: `${thresholds.windMinMs}–${thresholds.windMaxMs}`,
  });

  reasons.push({
    metric: "gust",
    passed: hour.gustMs <= thresholds.gustMaxMs,
    actual: round(hour.gustMs, 1),
    threshold: thresholds.gustMaxMs,
  });

  reasons.push({
    metric: "direction",
    passed: directionInAnyRange(hour.windDirectionDeg, allowedDirections),
    actual: hour.windDirectionDeg,
    threshold: formatRanges(allowedDirections),
  });

  reasons.push({
    metric: "air_temp",
    passed: hour.airTempC >= thresholds.airTempMinC,
    actual: round(hour.airTempC, 1),
    threshold: thresholds.airTempMinC,
  });

  if (thresholds.waterTempMinC !== null) {
    if (hour.waterTempC === null) {
      // Missing water temp with a threshold set → fail closed (safety).
      reasons.push({
        metric: "water_temp",
        passed: false,
        actual: "unknown",
        threshold: thresholds.waterTempMinC,
      });
    } else {
      reasons.push({
        metric: "water_temp",
        passed: hour.waterTempC >= thresholds.waterTempMinC,
        actual: round(hour.waterTempC, 1),
        threshold: thresholds.waterTempMinC,
      });
    }
  }

  reasons.push({
    metric: "precipitation",
    passed: hour.precipitationMm <= thresholds.precipitationMaxMmPerHr,
    actual: round(hour.precipitationMm, 1),
    threshold: thresholds.precipitationMaxMmPerHr,
  });

  return reasons;
}

// True if a single hour passes every threshold for a given spot + profile.
// Use when you need per-hour UI dots/highlights; for day-level decisions use
// evaluateDay which also considers the rideable-hours aggregation rule.
export function isHourRideable(
  hour: HourlyForecast,
  spot: Spot,
  thresholds: ThresholdProfile,
): boolean {
  const allowed =
    thresholds.directionsAllowed === "spot_default"
      ? spot.safeWindDirections
      : thresholds.directionsAllowed;
  const reasons = evaluateHour(hour, thresholds, allowed);
  return reasons.every((r) => r.passed);
}

export function directionInAnyRange(deg: number, ranges: DirectionRange[]): boolean {
  const normalized = ((deg % 360) + 360) % 360;
  return ranges.some((r) => directionInRange(normalized, r));
}

function directionInRange(deg: number, range: DirectionRange): boolean {
  const from = ((range.from % 360) + 360) % 360;
  const to = ((range.to % 360) + 360) % 360;
  if (from <= to) return deg >= from && deg <= to;
  // Wrapping range (e.g. from=340, to=40 covers 340°→360°→0°→40°).
  return deg >= from || deg <= to;
}

function formatRanges(ranges: DirectionRange[]): string {
  return ranges.map((r) => `${r.from}°–${r.to}°`).join(", ");
}

function round(n: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(n * factor) / factor;
}
