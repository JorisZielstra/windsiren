import type { TypedSupabaseClient } from "@windsiren/supabase";
import { listFollowingIds, type PublicProfile } from "./follows";
import { getPublicProfiles } from "./profiles";

export type FriendsOnWaterToday = {
  count: number;
  // First few profiles for inline display on the dashboard tile.
  // Always sorted alphabetically by display_name for stable rendering.
  profiles: PublicProfile[];
};

// Returns the followed users who either:
//   - logged a session today (session_date = todayKey), OR
//   - RSVPd for a spot today (planned_date = todayKey)
//
// Used by the home dashboard's "Friends on the water" tile. Empty result
// is the normal case (no one out yet, or viewer follows no one) — callers
// should not treat it as an error.
export async function getFriendsOnWaterToday(
  supabase: TypedSupabaseClient,
  userId: string,
  todayKey: string,
): Promise<FriendsOnWaterToday> {
  const followingIds = await listFollowingIds(supabase, userId);
  if (followingIds.length === 0) return { count: 0, profiles: [] };

  const [sessionsRes, rsvpsRes] = await Promise.all([
    supabase
      .from("sessions")
      .select("user_id")
      .eq("session_date", todayKey)
      .in("user_id", followingIds),
    supabase
      .from("rsvps")
      .select("user_id")
      .eq("planned_date", todayKey)
      .in("user_id", followingIds),
  ]);

  const activeIds = new Set<string>();
  for (const row of sessionsRes.data ?? []) activeIds.add(row.user_id);
  for (const row of rsvpsRes.data ?? []) activeIds.add(row.user_id);
  if (activeIds.size === 0) return { count: 0, profiles: [] };

  const profileMap = await getPublicProfiles(supabase, Array.from(activeIds));
  const profiles = Array.from(profileMap.values()).sort((a, b) => {
    const an = a.display_name ?? "";
    const bn = b.display_name ?? "";
    return an.localeCompare(bn);
  });

  return { count: activeIds.size, profiles };
}
