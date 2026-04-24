import type { RsvpRow, TypedSupabaseClient } from "@windsiren/supabase";

export type CreateRsvpResult =
  | { ok: true; rsvp: RsvpRow }
  | { ok: false; reason: "error"; message: string };

// Upsert semantics: "I'm going" is idempotent per (user, spot, day).
export async function createRsvp(
  supabase: TypedSupabaseClient,
  userId: string,
  spotId: string,
  plannedDate: string,
): Promise<CreateRsvpResult> {
  const { data, error } = await supabase
    .from("rsvps")
    .upsert(
      { user_id: userId, spot_id: spotId, planned_date: plannedDate },
      { onConflict: "user_id,spot_id,planned_date" },
    )
    .select("*")
    .single();
  if (error || !data) return { ok: false, reason: "error", message: error?.message ?? "Unknown" };
  return { ok: true, rsvp: data };
}

export async function deleteRsvp(
  supabase: TypedSupabaseClient,
  userId: string,
  spotId: string,
  plannedDate: string,
): Promise<{ ok: boolean; message?: string }> {
  const { error } = await supabase
    .from("rsvps")
    .delete()
    .eq("user_id", userId)
    .eq("spot_id", spotId)
    .eq("planned_date", plannedDate);
  if (error) return { ok: false, message: error.message };
  return { ok: true };
}

export async function listRsvpsForSpotOnDate(
  supabase: TypedSupabaseClient,
  spotId: string,
  plannedDate: string,
): Promise<RsvpRow[]> {
  const { data } = await supabase
    .from("rsvps")
    .select("*")
    .eq("spot_id", spotId)
    .eq("planned_date", plannedDate)
    .order("created_at", { ascending: true });
  return data ?? [];
}

export async function listUserRsvps(
  supabase: TypedSupabaseClient,
  userId: string,
  limit = 20,
): Promise<RsvpRow[]> {
  const { data } = await supabase
    .from("rsvps")
    .select("*")
    .eq("user_id", userId)
    .order("planned_date", { ascending: true })
    .limit(limit);
  return data ?? [];
}

// { "2026-04-24": 3, "2026-04-25": 1, ... }
export async function countRsvpsPerDay(
  supabase: TypedSupabaseClient,
  spotId: string,
  dateFrom: string,
  dateTo: string,
): Promise<Record<string, number>> {
  const { data } = await supabase
    .from("rsvps")
    .select("planned_date")
    .eq("spot_id", spotId)
    .gte("planned_date", dateFrom)
    .lte("planned_date", dateTo);
  const counts: Record<string, number> = {};
  for (const row of data ?? []) {
    counts[row.planned_date] = (counts[row.planned_date] ?? 0) + 1;
  }
  return counts;
}

export async function isUserRsvpdForDay(
  supabase: TypedSupabaseClient,
  userId: string,
  spotId: string,
  plannedDate: string,
): Promise<boolean> {
  const { data } = await supabase
    .from("rsvps")
    .select("id")
    .eq("user_id", userId)
    .eq("spot_id", spotId)
    .eq("planned_date", plannedDate)
    .maybeSingle();
  return data !== null;
}
