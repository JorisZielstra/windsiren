import type { SessionRow, TypedSupabaseClient } from "@windsiren/supabase";

export type CreateSessionInput = {
  userId: string;
  spotId: string;
  sessionDate: string;      // "YYYY-MM-DD"
  durationMinutes: number;
  notes?: string | null;
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
    })
    .select("*")
    .single();
  if (error || !data) {
    return { ok: false, reason: "error", message: error?.message ?? "Unknown error" };
  }
  return { ok: true, session: data };
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
