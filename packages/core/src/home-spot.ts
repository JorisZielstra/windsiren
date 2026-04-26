import type { Spot } from "@windsiren/shared";
import type { TypedSupabaseClient } from "@windsiren/supabase";
import { dbRowToSpot } from "./spots";

// Picks the spot to show in the persistent weather strip.
// Resolution order:
//   1. The viewer's first home spot (if signed in + has any) — proper
//      "this is where I kite" signal, beats every other heuristic.
//   2. The viewer's first favorite spot (legacy behavior, kept as a
//      gentler fallback for users who star spots but haven't promoted
//      any to home).
//   3. The most-favorited spot across all users (community popularity).
//   4. Fallback: first active spot alphabetically (deterministic).
//
// Returns null only if the spots table is empty.
export async function pickHomeSpot(
  supabase: TypedSupabaseClient,
  viewerId: string | null,
): Promise<Spot | null> {
  if (viewerId) {
    // 1. Viewer's first home spot (in user-stored position order)
    const { data: homes } = await supabase
      .from("home_spots")
      .select("spot_id")
      .eq("user_id", viewerId)
      .order("position", { ascending: true })
      .order("created_at", { ascending: true })
      .limit(1);
    const homeSpotId = homes?.[0]?.spot_id;
    if (homeSpotId) {
      const spot = await fetchSpotById(supabase, homeSpotId);
      if (spot) return spot;
    }

    // 2. Viewer's first favorite (legacy fallback)
    const { data: favs } = await supabase
      .from("favorite_spots")
      .select("spot_id")
      .eq("user_id", viewerId)
      .order("created_at", { ascending: true })
      .limit(1);
    const favSpotId = favs?.[0]?.spot_id;
    if (favSpotId) {
      const spot = await fetchSpotById(supabase, favSpotId);
      if (spot) return spot;
    }
  }

  // 3. Most-favorited spot across the community
  const popularId = await getMostFavoritedSpotId(supabase);
  if (popularId) {
    const spot = await fetchSpotById(supabase, popularId);
    if (spot) return spot;
  }

  // 4. First active spot alphabetically
  const { data: rows } = await supabase
    .from("spots")
    .select("*")
    .eq("active", true)
    .order("name", { ascending: true })
    .limit(1);
  return rows && rows[0] ? dbRowToSpot(rows[0]) : null;
}

async function fetchSpotById(
  supabase: TypedSupabaseClient,
  spotId: string,
): Promise<Spot | null> {
  const { data } = await supabase
    .from("spots")
    .select("*")
    .eq("id", spotId)
    .eq("active", true)
    .maybeSingle();
  return data ? dbRowToSpot(data) : null;
}

// Aggregate count over all favorite_spots; pick the one most users have
// favorited. v0.1 scale is fine to do client-side; swap to a Postgres
// function or materialized view when this query gets too big.
export async function getMostFavoritedSpotId(
  supabase: TypedSupabaseClient,
): Promise<string | null> {
  const { data } = await supabase.from("favorite_spots").select("spot_id");
  if (!data || data.length === 0) return null;
  const counts = new Map<string, number>();
  for (const row of data) {
    counts.set(row.spot_id, (counts.get(row.spot_id) ?? 0) + 1);
  }
  let best: string | null = null;
  let bestCount = 0;
  for (const [id, c] of counts) {
    if (c > bestCount) {
      best = id;
      bestCount = c;
    }
  }
  return best;
}
