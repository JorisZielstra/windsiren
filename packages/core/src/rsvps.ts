import type { RsvpRow, TypedSupabaseClient } from "@windsiren/supabase";

export type CreateRsvpResult =
  | { ok: true; rsvp: RsvpRow }
  | { ok: false; reason: "error"; message: string };

// `windowStartHour` is the start of a 2-hour slot in NL local time
// (0/2/.../22) or null for an all-day RSVP. The DB unique index treats
// null as a distinct "no window" slot, so a user can have one all-day
// RSVP plus several windowed RSVPs on the same date.
export async function createRsvp(
  supabase: TypedSupabaseClient,
  userId: string,
  spotId: string,
  plannedDate: string,
  windowStartHour: number | null = null,
): Promise<CreateRsvpResult> {
  const { data, error } = await supabase
    .from("rsvps")
    .insert({
      user_id: userId,
      spot_id: spotId,
      planned_date: plannedDate,
      planned_window_start_hour: windowStartHour,
    })
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
  windowStartHour: number | null = null,
): Promise<{ ok: boolean; message?: string }> {
  let q = supabase
    .from("rsvps")
    .delete()
    .eq("user_id", userId)
    .eq("spot_id", spotId)
    .eq("planned_date", plannedDate);
  q = windowStartHour === null
    ? q.is("planned_window_start_hour", null)
    : q.eq("planned_window_start_hour", windowStartHour);
  const { error } = await q;
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

// Map of {dateKey: {windowStartHour|"all": count}} for a spot across a
// date range. Used by the spot detail page to show which time slots
// have other kiters going.
export async function countRsvpWindowsPerDay(
  supabase: TypedSupabaseClient,
  spotId: string,
  dateFrom: string,
  dateTo: string,
): Promise<Map<string, Map<number | "all", number>>> {
  const { data } = await supabase
    .from("rsvps")
    .select("planned_date, planned_window_start_hour")
    .eq("spot_id", spotId)
    .gte("planned_date", dateFrom)
    .lte("planned_date", dateTo);
  const out = new Map<string, Map<number | "all", number>>();
  for (const row of data ?? []) {
    let dayMap = out.get(row.planned_date);
    if (!dayMap) {
      dayMap = new Map();
      out.set(row.planned_date, dayMap);
    }
    const key: number | "all" =
      row.planned_window_start_hour === null
        ? "all"
        : row.planned_window_start_hour;
    dayMap.set(key, (dayMap.get(key) ?? 0) + 1);
  }
  return out;
}

// Returns the user's RSVP windows for a given spot+day. Empty set =
// the user hasn't RSVPd. "all" means all-day, numbers are 2h slot
// start hours. A user can have several entries (e.g. 10–12 + 16–18).
export async function getUserRsvpWindowsForDay(
  supabase: TypedSupabaseClient,
  userId: string,
  spotId: string,
  plannedDate: string,
): Promise<Set<number | "all">> {
  const { data } = await supabase
    .from("rsvps")
    .select("planned_window_start_hour")
    .eq("user_id", userId)
    .eq("spot_id", spotId)
    .eq("planned_date", plannedDate);
  const out = new Set<number | "all">();
  for (const row of data ?? []) {
    out.add(
      row.planned_window_start_hour === null
        ? "all"
        : row.planned_window_start_hour,
    );
  }
  return out;
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
    .limit(1)
    .maybeSingle();
  return data !== null;
}
