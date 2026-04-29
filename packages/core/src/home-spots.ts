import type { Spot } from "@windsiren/shared";
import type { TypedSupabaseClient } from "@windsiren/supabase";
import { dbRowToSpot } from "./spots";

// Soft cap for the UI to suggest. There's no hard DB limit; users can set
// as many home spots as they like, but the dashboard guides toward a
// focused set.
export const SUGGESTED_HOME_SPOT_MAX = 3;

export type HomeSpotResult =
  | { ok: true; isHome: boolean }
  | { ok: false; reason: "unauthenticated" | "error"; message: string };

// Fetches the spot rows for every home spot the user has set, ordered by
// the user's stored position (then created_at as a tiebreaker via the
// composite ordering on the join). Inactive spots are filtered out.
export async function fetchHomeSpots(
  supabase: TypedSupabaseClient,
  userId: string,
): Promise<Spot[]> {
  const { data: rows } = await supabase
    .from("home_spots")
    .select("spot_id, position")
    .eq("user_id", userId)
    .order("position", { ascending: true })
    .order("created_at", { ascending: true });
  if (!rows || rows.length === 0) return [];

  const orderedIds = rows.map((r) => r.spot_id);
  const { data: spotRows } = await supabase
    .from("spots")
    .select("*")
    .in("id", orderedIds)
    .eq("active", true);
  const byId = new Map((spotRows ?? []).map((s) => [s.id, dbRowToSpot(s)]));
  return orderedIds.map((id) => byId.get(id)).filter((s): s is Spot => !!s);
}

// Set form for the dashboard's "is this spot in my personalized scope?"
// check. Cheap query — composite PK on (user_id, spot_id) makes this
// effectively an index scan.
export async function fetchHomeSpotIds(
  supabase: TypedSupabaseClient,
  userId: string,
): Promise<Set<string>> {
  const { data } = await supabase
    .from("home_spots")
    .select("spot_id")
    .eq("user_id", userId);
  return new Set((data ?? []).map((r) => r.spot_id));
}

export async function isHomeSpot(
  supabase: TypedSupabaseClient,
  userId: string,
  spotId: string,
): Promise<boolean> {
  const { data } = await supabase
    .from("home_spots")
    .select("spot_id")
    .eq("user_id", userId)
    .eq("spot_id", spotId)
    .maybeSingle();
  return data !== null;
}

// Adds a home spot. Position defaults to (max existing position + 1) so
// new entries land at the end of the user's list. We pre-read the max
// here rather than relying on a DB trigger — single round-trip is fine
// at v0.1 cardinality (a user has at most a few dozen home spots).
export async function addHomeSpot(
  supabase: TypedSupabaseClient,
  userId: string,
  spotId: string,
): Promise<HomeSpotResult> {
  const { data: existing } = await supabase
    .from("home_spots")
    .select("position")
    .eq("user_id", userId)
    .order("position", { ascending: false })
    .limit(1);
  const nextPosition =
    existing && existing.length > 0 ? (existing[0]!.position ?? 0) + 1 : 0;

  const { error } = await supabase
    .from("home_spots")
    .insert({ user_id: userId, spot_id: spotId, position: nextPosition });
  if (!error) return { ok: true, isHome: true };
  // Already pinned — onboarding re-runs, double-clicks, and stale UI all
  // surface as 23505 on the (user_id, spot_id) PK. Treat as success so
  // the welcome flow doesn't bail out mid-loop.
  if (error.code === "23505") return { ok: true, isHome: true };
  return { ok: false, reason: "error", message: error.message };
}

export async function removeHomeSpot(
  supabase: TypedSupabaseClient,
  userId: string,
  spotId: string,
): Promise<HomeSpotResult> {
  const { error } = await supabase
    .from("home_spots")
    .delete()
    .eq("user_id", userId)
    .eq("spot_id", spotId);
  if (error) return { ok: false, reason: "error", message: error.message };
  return { ok: true, isHome: false };
}
