import type { TypedSupabaseClient } from "@windsiren/supabase";

export type LikeResult =
  | { ok: true; liked: boolean }
  | { ok: false; reason: "error"; message: string };

export async function likeSession(
  supabase: TypedSupabaseClient,
  userId: string,
  sessionId: string,
): Promise<LikeResult> {
  const { error } = await supabase
    .from("likes")
    .insert({ user_id: userId, session_id: sessionId });
  if (!error) return { ok: true, liked: true };
  // Already liked is treated as success.
  if (error.code === "23505") return { ok: true, liked: true };
  return { ok: false, reason: "error", message: error.message };
}

export async function unlikeSession(
  supabase: TypedSupabaseClient,
  userId: string,
  sessionId: string,
): Promise<LikeResult> {
  const { error } = await supabase
    .from("likes")
    .delete()
    .eq("user_id", userId)
    .eq("session_id", sessionId);
  if (error) return { ok: false, reason: "error", message: error.message };
  return { ok: true, liked: false };
}

export async function isSessionLiked(
  supabase: TypedSupabaseClient,
  userId: string,
  sessionId: string,
): Promise<boolean> {
  const { data } = await supabase
    .from("likes")
    .select("session_id")
    .eq("user_id", userId)
    .eq("session_id", sessionId)
    .maybeSingle();
  return data !== null;
}

// Batch helpers — used by feed + spot rows to avoid N+1.

export async function getLikeCounts(
  supabase: TypedSupabaseClient,
  sessionIds: string[],
): Promise<Map<string, number>> {
  if (sessionIds.length === 0) return new Map();
  const { data } = await supabase
    .from("likes")
    .select("session_id")
    .in("session_id", sessionIds);
  const counts = new Map<string, number>();
  for (const row of data ?? []) {
    counts.set(row.session_id, (counts.get(row.session_id) ?? 0) + 1);
  }
  return counts;
}

export async function getLikedSessionIds(
  supabase: TypedSupabaseClient,
  userId: string,
  sessionIds: string[],
): Promise<Set<string>> {
  if (sessionIds.length === 0) return new Set();
  const { data } = await supabase
    .from("likes")
    .select("session_id")
    .eq("user_id", userId)
    .in("session_id", sessionIds);
  return new Set((data ?? []).map((r) => r.session_id));
}
