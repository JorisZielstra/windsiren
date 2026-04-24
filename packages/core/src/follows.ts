import type { TypedSupabaseClient, UserRow } from "@windsiren/supabase";

export type PublicProfile = Pick<UserRow, "id" | "display_name" | "avatar_url" | "bio" | "created_at">;

export type FollowCounts = { followers: number; following: number };

export type FollowResult =
  | { ok: true; following: boolean }
  | { ok: false; reason: "unauthenticated" | "error"; message: string };

// --- Reads -------------------------------------------------------------------

export async function isFollowing(
  supabase: TypedSupabaseClient,
  followerId: string,
  followeeId: string,
): Promise<boolean> {
  if (followerId === followeeId) return false;
  const { data } = await supabase
    .from("follows")
    .select("follower_id")
    .eq("follower_id", followerId)
    .eq("followee_id", followeeId)
    .maybeSingle();
  return data !== null;
}

export async function getFollowCounts(
  supabase: TypedSupabaseClient,
  userId: string,
): Promise<FollowCounts> {
  const [{ count: followers }, { count: following }] = await Promise.all([
    supabase
      .from("follows")
      .select("follower_id", { count: "exact", head: true })
      .eq("followee_id", userId),
    supabase
      .from("follows")
      .select("followee_id", { count: "exact", head: true })
      .eq("follower_id", userId),
  ]);
  return { followers: followers ?? 0, following: following ?? 0 };
}

export async function listFollowerIds(
  supabase: TypedSupabaseClient,
  userId: string,
): Promise<string[]> {
  const { data } = await supabase
    .from("follows")
    .select("follower_id")
    .eq("followee_id", userId);
  return (data ?? []).map((r) => r.follower_id);
}

export async function listFollowingIds(
  supabase: TypedSupabaseClient,
  userId: string,
): Promise<string[]> {
  const { data } = await supabase
    .from("follows")
    .select("followee_id")
    .eq("follower_id", userId);
  return (data ?? []).map((r) => r.followee_id);
}

// --- Writes ------------------------------------------------------------------

export async function followUser(
  supabase: TypedSupabaseClient,
  followerId: string,
  followeeId: string,
): Promise<FollowResult> {
  if (followerId === followeeId) {
    return { ok: false, reason: "error", message: "Can't follow yourself" };
  }
  const { error } = await supabase
    .from("follows")
    .insert({ follower_id: followerId, followee_id: followeeId });
  if (!error) return { ok: true, following: true };
  // Duplicate follow is idempotent — treat as success.
  if (error.code === "23505") return { ok: true, following: true };
  return { ok: false, reason: "error", message: error.message };
}

export async function unfollowUser(
  supabase: TypedSupabaseClient,
  followerId: string,
  followeeId: string,
): Promise<FollowResult> {
  const { error } = await supabase
    .from("follows")
    .delete()
    .eq("follower_id", followerId)
    .eq("followee_id", followeeId);
  if (error) return { ok: false, reason: "error", message: error.message };
  return { ok: true, following: false };
}
