import { OpenMeteoForecastSource } from "@windsiren/providers";
import type { Spot } from "@windsiren/shared";
import type { SessionRow, TypedSupabaseClient } from "@windsiren/supabase";

export type CreateSessionInput = {
  userId: string;
  spotId: string;
  sessionDate: string;      // "YYYY-MM-DD"
  durationMinutes: number;
  notes?: string | null;
  windAvgMs?: number | null;
  windMaxMs?: number | null;
  windDirAvgDeg?: number | null;
  gustMaxMs?: number | null;
};

export type CreateSessionResult =
  | { ok: true; session: SessionRow }
  | { ok: false; reason: "validation" | "error"; message: string };

export async function createSession(
  supabase: TypedSupabaseClient,
  input: CreateSessionInput,
): Promise<CreateSessionResult> {
  if (!Number.isFinite(input.durationMinutes) || input.durationMinutes <= 0 || input.durationMinutes >= 1440) {
    return {
      ok: false,
      reason: "validation",
      message: "Duration must be between 1 and 1439 minutes",
    };
  }
  const { data, error } = await supabase
    .from("sessions")
    .insert({
      user_id: input.userId,
      spot_id: input.spotId,
      session_date: input.sessionDate,
      duration_minutes: input.durationMinutes,
      notes: input.notes ?? null,
      wind_avg_ms: input.windAvgMs ?? null,
      wind_max_ms: input.windMaxMs ?? null,
      wind_dir_avg_deg: input.windDirAvgDeg ?? null,
      gust_max_ms: input.gustMaxMs ?? null,
    })
    .select("*")
    .single();
  if (error || !data) {
    return { ok: false, reason: "error", message: error?.message ?? "Unknown error" };
  }
  return { ok: true, session: data };
}

export type WindSummary = {
  windAvgMs: number;
  windMaxMs: number;
  windDirAvgDeg: number;
  gustMaxMs: number;
};

// Computes a daylight-hours wind summary (08:00–20:00 NL local) for the
// given spot, by querying Open-Meteo forecast hours for the session date
// and averaging across hours that fall in the window.
//
// Limitations of this v0.1 implementation:
//   - Only works for sessionDate that's *today* — Open-Meteo's free hourly
//     forecast endpoint covers today + the next ~7 days. For backdated
//     sessions (yesterday, 2 days ago, etc.) we'd need the archive API
//     and that's a follow-up.
//   - Direction averaged using vector mean (sin/cos) so 350°+10° gives 0°,
//     not 180°.
//
// Returns null on any failure (network, no overlap, etc.) — callers
// must keep the session creation flow non-fatal.
export async function summarizeWindForToday(
  spot: Spot,
  fetchImpl?: typeof fetch,
): Promise<WindSummary | null> {
  try {
    const source = new OpenMeteoForecastSource(fetchImpl);
    const hours = await source.fetchHourly(spot.lat, spot.lng, 1);
    if (hours.length === 0) return null;

    const today = nlLocalDateKey(new Date());
    const dayHours = hours.filter((h) => {
      // Filter by NL local date and 08:00–20:00 local hour window.
      const date = new Date(h.time);
      const localKey = nlLocalDateKey(date);
      if (localKey !== today) return false;
      const localHour = nlLocalHour(date);
      return localHour >= 8 && localHour <= 20;
    });
    if (dayHours.length === 0) return null;

    const speeds = dayHours.map((h) => h.windSpeedMs);
    const gusts = dayHours.map((h) => h.gustMs);
    const dirs = dayHours.map((h) => h.windDirectionDeg);

    return {
      windAvgMs: avg(speeds),
      windMaxMs: Math.max(...speeds),
      windDirAvgDeg: averageDirectionDeg(dirs),
      gustMaxMs: Math.max(...gusts),
    };
  } catch {
    return null;
  }
}

function nlLocalDateKey(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Amsterdam",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

function nlLocalHour(d: Date): number {
  const hh = new Intl.DateTimeFormat("en-NL", {
    timeZone: "Europe/Amsterdam",
    hour: "2-digit",
    hour12: false,
  }).format(d);
  return parseInt(hh, 10);
}

function avg(xs: number[]): number {
  return xs.reduce((s, x) => s + x, 0) / xs.length;
}

// Vector-mean wind direction: avoids the 350°+10° → 180° trap.
function averageDirectionDeg(angles: number[]): number {
  let sumSin = 0;
  let sumCos = 0;
  for (const a of angles) {
    const rad = (a * Math.PI) / 180;
    sumSin += Math.sin(rad);
    sumCos += Math.cos(rad);
  }
  let deg = (Math.atan2(sumSin, sumCos) * 180) / Math.PI;
  if (deg < 0) deg += 360;
  return deg;
}

export async function deleteSession(
  supabase: TypedSupabaseClient,
  sessionId: string,
): Promise<{ ok: boolean; message?: string }> {
  const { error } = await supabase.from("sessions").delete().eq("id", sessionId);
  if (error) return { ok: false, message: error.message };
  return { ok: true };
}

export async function getSession(
  supabase: TypedSupabaseClient,
  sessionId: string,
): Promise<SessionRow | null> {
  const { data } = await supabase
    .from("sessions")
    .select("*")
    .eq("id", sessionId)
    .maybeSingle();
  return data;
}

export async function listSessionsForUser(
  supabase: TypedSupabaseClient,
  userId: string,
  limit = 20,
): Promise<SessionRow[]> {
  const { data } = await supabase
    .from("sessions")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);
  return data ?? [];
}

export async function listSessionsForSpot(
  supabase: TypedSupabaseClient,
  spotId: string,
  limit = 20,
): Promise<SessionRow[]> {
  const { data } = await supabase
    .from("sessions")
    .select("*")
    .eq("spot_id", spotId)
    .order("created_at", { ascending: false })
    .limit(limit);
  return data ?? [];
}
