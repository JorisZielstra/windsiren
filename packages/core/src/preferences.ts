import {
  DEFAULT_THRESHOLDS,
  type ThresholdProfile,
} from "@windsiren/shared";
import type { TypedSupabaseClient } from "@windsiren/supabase";

// Personal kite-condition thresholds. Stored on `users` in knots /
// Celsius (the units kiters think in); converted to m/s for the
// decision engine via `prefsToThresholds`.
//
// Only `minWindKn` is non-optional in the resolved profile — when the
// user hasn't set anything we fall back to 15 kn (product default).
// Every other field maps null → "no constraint" (gust ceiling lifted,
// no temperature gates).
export type UserKitePrefs = {
  minWindKn: number;
  maxGustKn: number | null;
  minAirTempC: number | null;
  minWaterTempC: number | null;
};

// What a fresh, unset user gets.
export const DEFAULT_USER_PREFS: UserKitePrefs = {
  minWindKn: 15,
  maxGustKn: null,
  minAirTempC: null,
  minWaterTempC: null,
};

const KN_PER_MS = 1.94384;

export function knToMs(kn: number): number {
  return kn / KN_PER_MS;
}

export function msToKnRounded(ms: number): number {
  return Math.round(ms * KN_PER_MS);
}

// Reads the user's stored prefs, applying defaults for anything unset.
// Returns DEFAULT_USER_PREFS for unknown / signed-out viewers so the
// caller can blindly hand the result to `prefsToThresholds`.
export async function getUserPrefs(
  supabase: TypedSupabaseClient,
  userId: string | null,
): Promise<UserKitePrefs> {
  if (!userId) return DEFAULT_USER_PREFS;
  const { data } = await supabase
    .from("users")
    .select(
      "pref_min_wind_kn, pref_max_gust_kn, pref_min_air_temp_c, pref_min_water_temp_c",
    )
    .eq("id", userId)
    .maybeSingle();
  return {
    minWindKn: data?.pref_min_wind_kn ?? DEFAULT_USER_PREFS.minWindKn,
    maxGustKn: data?.pref_max_gust_kn ?? null,
    minAirTempC: data?.pref_min_air_temp_c ?? null,
    minWaterTempC: data?.pref_min_water_temp_c ?? null,
  };
}

export type UpdatePrefsResult =
  | { ok: true }
  | { ok: false; reason: "validation" | "error"; message: string };

export async function updateUserPrefs(
  supabase: TypedSupabaseClient,
  userId: string,
  input: Partial<UserKitePrefs>,
): Promise<UpdatePrefsResult> {
  // Light validation — the DB CHECK constraints will reject anything
  // egregious, but we'd rather fail fast with a friendly message than
  // surface a 23514 from Postgres.
  if (input.minWindKn !== undefined && input.minWindKn !== null) {
    if (input.minWindKn < 1 || input.minWindKn > 60) {
      return { ok: false, reason: "validation", message: "Min wind must be 1–60 kn." };
    }
  }
  if (input.maxGustKn !== undefined && input.maxGustKn !== null) {
    if (input.maxGustKn < 1 || input.maxGustKn > 100) {
      return { ok: false, reason: "validation", message: "Max gust must be 1–100 kn." };
    }
  }
  if (input.minAirTempC !== undefined && input.minAirTempC !== null) {
    if (input.minAirTempC < -20 || input.minAirTempC > 50) {
      return { ok: false, reason: "validation", message: "Min air temp must be -20…50 °C." };
    }
  }
  if (input.minWaterTempC !== undefined && input.minWaterTempC !== null) {
    if (input.minWaterTempC < 0 || input.minWaterTempC > 35) {
      return { ok: false, reason: "validation", message: "Min water temp must be 0–35 °C." };
    }
  }

  const update: {
    pref_min_wind_kn?: number | null;
    pref_max_gust_kn?: number | null;
    pref_min_air_temp_c?: number | null;
    pref_min_water_temp_c?: number | null;
  } = {};
  if (input.minWindKn !== undefined) update.pref_min_wind_kn = input.minWindKn;
  if (input.maxGustKn !== undefined) update.pref_max_gust_kn = input.maxGustKn;
  if (input.minAirTempC !== undefined) update.pref_min_air_temp_c = input.minAirTempC;
  if (input.minWaterTempC !== undefined) update.pref_min_water_temp_c = input.minWaterTempC;

  if (Object.keys(update).length === 0) return { ok: true };

  const { error } = await supabase.from("users").update(update).eq("id", userId);
  if (error) return { ok: false, reason: "error", message: error.message };
  return { ok: true };
}

// Convert a user's prefs into the engine's ThresholdProfile.
// - Wind min: user's value (default 15 kn) → m/s.
// - Wind max: hard-coded 50 kn cap (above any kiteable wind). We don't
//   surface a max-wind preference yet, but the engine still needs one.
// - Gust max: user-set or +Infinity (lifts the cap entirely).
// - Air temp: user-set or -Infinity.
// - Water temp: user-set or null (engine already understands null).
// The non-tunable fields (precipitation, daylight) keep their defaults
// so kite gates the user *didn't* opt to control still apply sensibly.
export function prefsToThresholds(prefs: UserKitePrefs): ThresholdProfile {
  return {
    windMinMs: knToMs(prefs.minWindKn),
    windMaxMs: knToMs(50),
    gustMaxMs: prefs.maxGustKn !== null ? knToMs(prefs.maxGustKn) : Infinity,
    directionsAllowed: "spot_default",
    airTempMinC: prefs.minAirTempC !== null ? prefs.minAirTempC : -Infinity,
    waterTempMinC: prefs.minWaterTempC,
    precipitationMaxMmPerHr: DEFAULT_THRESHOLDS.precipitationMaxMmPerHr,
    tidePreference: DEFAULT_THRESHOLDS.tidePreference,
    daylightOnly: DEFAULT_THRESHOLDS.daylightOnly,
  };
}
