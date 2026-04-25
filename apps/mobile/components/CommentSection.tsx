import { Link, router } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import {
  COMMENT_MAX_LENGTH,
  createComment,
  deleteComment,
  getPublicProfiles,
  listCommentsForSession,
  type PublicProfile,
} from "@windsiren/core";
import type { SessionCommentRow } from "@windsiren/supabase";
import { useAuth } from "../lib/auth-context";
import { supabase } from "../lib/supabase";

type Props = {
  sessionId: string;
  initialCount: number;
};

export function CommentSection({ sessionId, initialCount }: Props) {
  const { user } = useAuth();
  const [count, setCount] = useState(initialCount);
  const [open, setOpen] = useState(false);
  const [comments, setComments] = useState<SessionCommentRow[] | null>(null);
  const [profiles, setProfiles] = useState<Map<string, PublicProfile>>(new Map());
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadIfNeeded() {
    if (comments !== null) return;
    const list = await listCommentsForSession(supabase, sessionId);
    setComments(list);
    const authorIds = Array.from(new Set(list.map((c) => c.user_id)));
    setProfiles(await getPublicProfiles(supabase, authorIds));
  }

  async function toggle() {
    const next = !open;
    setOpen(next);
    if (next) await loadIfNeeded();
  }

  async function onSubmit() {
    if (!user) return;
    setBusy(true);
    setError(null);
    const result = await createComment(supabase, user.id, sessionId, body);
    setBusy(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setBody("");
    setComments((prev) => (prev ? [...prev, result.comment] : [result.comment]));
    setCount((c) => c + 1);
    if (!profiles.has(user.id)) {
      const map = await getPublicProfiles(supabase, [user.id]);
      setProfiles((prev) => new Map([...prev, ...map]));
    }
  }

  async function onDelete(commentId: string) {
    const r = await deleteComment(supabase, commentId);
    if (!r.ok) return;
    setComments((prev) => prev?.filter((c) => c.id !== commentId) ?? null);
    setCount((c) => Math.max(0, c - 1));
  }

  return (
    <View style={styles.wrap}>
      <Pressable onPress={toggle} style={styles.toggle}>
        <Text style={styles.toggleText}>
          💬 <Text style={styles.toggleCount}>{count}</Text>{" "}
          {open ? "— hide" : count === 1 ? "comment" : "comments"}
        </Text>
      </Pressable>

      {open ? (
        <View style={styles.panel}>
          {comments === null ? (
            <ActivityIndicator />
          ) : comments.length === 0 ? (
            <Text style={styles.empty}>No comments yet.</Text>
          ) : (
            comments.map((c) => {
              const author = profiles.get(c.user_id);
              const isMine = user?.id === c.user_id;
              return (
                <View key={c.id} style={styles.comment}>
                  <View style={styles.commentHeader}>
                    <Link href={`/users/${c.user_id}`} asChild>
                      <Pressable>
                        <Text style={styles.commentAuthor}>
                          {author?.display_name ?? "Someone"}
                        </Text>
                      </Pressable>
                    </Link>
                    <Text style={styles.commentTime}>{relativeTime(c.created_at)}</Text>
                  </View>
                  <Text style={styles.commentBody}>{c.body}</Text>
                  {isMine ? (
                    <Pressable onPress={() => onDelete(c.id)}>
                      <Text style={styles.deleteText}>Delete</Text>
                    </Pressable>
                  ) : null}
                </View>
              );
            })
          )}

          {user ? (
            <View style={styles.composer}>
              <TextInput
                value={body}
                onChangeText={setBody}
                placeholder="Add a comment…"
                placeholderTextColor="#a1a1aa"
                multiline
                maxLength={COMMENT_MAX_LENGTH}
                style={styles.composerInput}
              />
              {error ? <Text style={styles.error}>{error}</Text> : null}
              <View style={styles.composerActions}>
                <Text style={styles.charCount}>
                  {body.length}/{COMMENT_MAX_LENGTH}
                </Text>
                <Pressable
                  style={[styles.postBtn, (busy || body.trim().length === 0) && { opacity: 0.5 }]}
                  onPress={onSubmit}
                  disabled={busy || body.trim().length === 0}
                >
                  <Text style={styles.postBtnText}>{busy ? "Posting…" : "Post"}</Text>
                </Pressable>
              </View>
            </View>
          ) : (
            <Pressable onPress={() => router.push("/sign-in")}>
              <Text style={styles.signInText}>Sign in to comment</Text>
            </Pressable>
          )}
        </View>
      ) : null}
    </View>
  );
}

function relativeTime(iso: string): string {
  const diffMin = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin} min ago`;
  const h = Math.round(diffMin / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString("en-NL", { month: "short", day: "numeric" });
}

const styles = StyleSheet.create({
  wrap: { marginTop: 6 },
  toggle: { paddingVertical: 4 },
  toggleText: { fontSize: 13, color: "#71717a" },
  toggleCount: { fontVariant: ["tabular-nums"], fontWeight: "600", color: "#52525b" },
  panel: {
    marginTop: 8,
    padding: 10,
    borderRadius: 8,
    backgroundColor: "#fafafa",
    borderWidth: 1,
    borderColor: "#e5e5e5",
  },
  empty: { fontSize: 12, color: "#9ca3af" },
  comment: {
    backgroundColor: "#fff",
    borderRadius: 6,
    padding: 8,
    marginBottom: 6,
  },
  commentHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" },
  commentAuthor: { fontSize: 13, fontWeight: "600", color: "#0369a1" },
  commentTime: { fontSize: 11, color: "#6b7280" },
  commentBody: { marginTop: 4, fontSize: 14, color: "#18181b", lineHeight: 18 },
  deleteText: { marginTop: 4, fontSize: 11, color: "#9ca3af" },
  composer: { marginTop: 8, borderTopWidth: 1, borderTopColor: "#e5e5e5", paddingTop: 8 },
  composerInput: {
    borderWidth: 1,
    borderColor: "#d4d4d8",
    borderRadius: 6,
    padding: 8,
    fontSize: 14,
    minHeight: 60,
    textAlignVertical: "top",
  },
  composerActions: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 6 },
  charCount: { fontSize: 11, color: "#6b7280" },
  postBtn: { backgroundColor: "#18181b", paddingHorizontal: 14, paddingVertical: 6, borderRadius: 6 },
  postBtnText: { color: "#fff", fontSize: 13, fontWeight: "600" },
  error: { color: "#b91c1c", fontSize: 12, marginTop: 4 },
  signInText: { fontSize: 12, color: "#0369a1", textDecorationLine: "underline", marginTop: 8 },
});
