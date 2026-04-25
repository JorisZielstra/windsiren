import type { SessionCommentRow, TypedSupabaseClient } from "@windsiren/supabase";

export const COMMENT_MAX_LENGTH = 1000;

export type CreateCommentResult =
  | { ok: true; comment: SessionCommentRow }
  | { ok: false; reason: "validation" | "error"; message: string };

export async function createComment(
  supabase: TypedSupabaseClient,
  userId: string,
  sessionId: string,
  body: string,
): Promise<CreateCommentResult> {
  const trimmed = body.trim();
  if (trimmed.length === 0) {
    return { ok: false, reason: "validation", message: "Comment can't be empty" };
  }
  if (trimmed.length > COMMENT_MAX_LENGTH) {
    return {
      ok: false,
      reason: "validation",
      message: `Max ${COMMENT_MAX_LENGTH} characters`,
    };
  }
  const { data, error } = await supabase
    .from("session_comments")
    .insert({ user_id: userId, session_id: sessionId, body: trimmed })
    .select("*")
    .single();
  if (error || !data) {
    return { ok: false, reason: "error", message: error?.message ?? "Insert failed" };
  }
  return { ok: true, comment: data };
}

export async function deleteComment(
  supabase: TypedSupabaseClient,
  commentId: string,
): Promise<{ ok: boolean; message?: string }> {
  const { error } = await supabase.from("session_comments").delete().eq("id", commentId);
  if (error) return { ok: false, message: error.message };
  return { ok: true };
}

export async function listCommentsForSession(
  supabase: TypedSupabaseClient,
  sessionId: string,
): Promise<SessionCommentRow[]> {
  const { data } = await supabase
    .from("session_comments")
    .select("*")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true });
  return data ?? [];
}

export async function getCommentCounts(
  supabase: TypedSupabaseClient,
  sessionIds: string[],
): Promise<Map<string, number>> {
  if (sessionIds.length === 0) return new Map();
  const { data } = await supabase
    .from("session_comments")
    .select("session_id")
    .in("session_id", sessionIds);
  const counts = new Map<string, number>();
  for (const row of data ?? []) {
    counts.set(row.session_id, (counts.get(row.session_id) ?? 0) + 1);
  }
  return counts;
}
