import type { SessionTrackRow, TypedSupabaseClient } from "@windsiren/supabase";

// Earth's gravitational acceleration in m/s². Constant in our latitudes
// to better than 0.1%, so a literal is fine.
export const G = 9.80665;

// Translate airtime (seconds between takeoff and landing) into peak
// jump height. Free-fall kinematics: h = (g · t²) / 8 — the "/8" comes
// from the symmetric up-and-down split (h_up = g·(t/2)²/2 = g·t²/8).
// Same formula Woo Sports / kitesurfing GPS units have used for years.
export function airtimeToJumpHeight(airtimeS: number): number {
  if (airtimeS <= 0) return 0;
  return (G * airtimeS * airtimeS) / 8;
}

// Magnitude of a 3-axis accelerometer sample, in g (earth-gravity units
// where 1 g ≈ 9.81 m/s²). expo-sensors returns values already in g, so
// no conversion needed — just sqrt(x²+y²+z²).
export function accelMagnitudeG(x: number, y: number, z: number): number {
  return Math.sqrt(x * x + y * y + z * z);
}

export type AccelSample = {
  // Net magnitude in g (1 g = stationary, 0 g = freefall, >1 g = impact).
  mag: number;
  // ms timestamp.
  t: number;
};

export type DetectedJump = {
  // Wall-clock ISO timestamp at takeoff.
  t: string;
  airtimeS: number;
  heightM: number;
};

type DetectorState =
  | { phase: "grounded" }
  // We're seeing freefall but haven't crossed the min-airtime threshold yet.
  | { phase: "airborne"; takeoffMs: number };

// Tunable thresholds. Defaults pulled from common kite-tracking
// implementations + a margin to suppress false positives from board
// chatter / chop. Override per-device if needed in a follow-up.
export type JumpDetectorOptions = {
  // Net g below this counts as "in the air".
  freefallG: number;
  // Net g above this counts as a landing impact.
  landingG: number;
  // Minimum airtime to count (filter sensor noise / small chops).
  minAirtimeS: number;
  // Maximum airtime — anything longer is almost certainly a stationary
  // glitch (phone fell off the board, etc.), drop it.
  maxAirtimeS: number;
};

export const DEFAULT_JUMP_DETECTOR_OPTIONS: JumpDetectorOptions = {
  freefallG: 0.4,
  landingG: 1.6,
  minAirtimeS: 0.5,
  maxAirtimeS: 8,
};

// Streaming jump detector. Push() each accelerometer sample as it
// arrives; the detector emits a DetectedJump via the supplied callback
// whenever it sees a complete free-fall → landing transition.
//
// Pure state machine, no DOM / RN deps — testable without mocks.
export class JumpDetector {
  private state: DetectorState = { phase: "grounded" };
  private readonly options: JumpDetectorOptions;
  private readonly onJump: (jump: DetectedJump) => void;

  constructor(
    onJump: (jump: DetectedJump) => void,
    options: Partial<JumpDetectorOptions> = {},
  ) {
    this.options = { ...DEFAULT_JUMP_DETECTOR_OPTIONS, ...options };
    this.onJump = onJump;
  }

  push(sample: AccelSample): void {
    const { freefallG, landingG, minAirtimeS, maxAirtimeS } = this.options;
    if (this.state.phase === "grounded") {
      if (sample.mag < freefallG) {
        this.state = { phase: "airborne", takeoffMs: sample.t };
      }
      return;
    }
    // airborne
    if (sample.mag > landingG) {
      const airtimeS = (sample.t - this.state.takeoffMs) / 1000;
      this.state = { phase: "grounded" };
      if (airtimeS < minAirtimeS || airtimeS > maxAirtimeS) return;
      this.onJump({
        t: new Date(sample.t - airtimeS * 1000).toISOString(),
        airtimeS,
        heightM: airtimeToJumpHeight(airtimeS),
      });
    }
  }

  reset(): void {
    this.state = { phase: "grounded" };
  }
}

// Haversine distance in meters between two lat/lng points.
export function haversineMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6_371_000;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

// ---------------------------------------------------------------------------
// Persistence
// ---------------------------------------------------------------------------

export type TrackPoint = {
  t: string; // ISO timestamp
  lat: number;
  lng: number;
  speed: number; // m/s
};

export type SaveTrackInput = {
  sessionId: string;
  userId: string;
  topSpeedMs: number;
  distanceM: number;
  jumpCount: number;
  maxJumpM: number;
  polyline: TrackPoint[];
  jumps: DetectedJump[];
};

export type SaveTrackResult =
  | { ok: true; track: SessionTrackRow }
  | { ok: false; reason: "error"; message: string };

export async function saveSessionTrack(
  supabase: TypedSupabaseClient,
  input: SaveTrackInput,
): Promise<SaveTrackResult> {
  const { data, error } = await supabase
    .from("session_tracks")
    .insert({
      session_id: input.sessionId,
      user_id: input.userId,
      top_speed_ms: input.topSpeedMs,
      distance_m: input.distanceM,
      jump_count: input.jumpCount,
      max_jump_m: input.maxJumpM,
      polyline: input.polyline,
      jumps: input.jumps,
    })
    .select("*")
    .single();
  if (error || !data) {
    return { ok: false, reason: "error", message: error?.message ?? "Unknown" };
  }
  return { ok: true, track: data };
}

export async function getSessionTrack(
  supabase: TypedSupabaseClient,
  sessionId: string,
): Promise<SessionTrackRow | null> {
  const { data } = await supabase
    .from("session_tracks")
    .select("*")
    .eq("session_id", sessionId)
    .maybeSingle();
  return data;
}
