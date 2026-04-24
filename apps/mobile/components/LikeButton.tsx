import { router } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, Text } from "react-native";
import { likeSession, unlikeSession } from "@windsiren/core";
import { useAuth } from "../lib/auth-context";
import { supabase } from "../lib/supabase";

type Props = {
  sessionId: string;
  initialCount: number;
  initialLiked: boolean;
};

export function LikeButton({ sessionId, initialCount, initialLiked }: Props) {
  const { user } = useAuth();
  const [liked, setLiked] = useState(initialLiked);
  const [count, setCount] = useState(initialCount);
  const [busy, setBusy] = useState(false);

  async function onPress() {
    if (!user) {
      router.push("/sign-in");
      return;
    }
    if (busy) return;
    setBusy(true);
    const wasLiked = liked;
    setLiked(!wasLiked);
    setCount((c) => c + (wasLiked ? -1 : 1));
    const result = wasLiked
      ? await unlikeSession(supabase, user.id, sessionId)
      : await likeSession(supabase, user.id, sessionId);
    if (!result.ok) {
      setLiked(wasLiked);
      setCount((c) => c + (wasLiked ? 1 : -1));
    }
    setBusy(false);
  }

  return (
    <Pressable onPress={onPress} disabled={busy} style={styles.btn}>
      <Text style={[styles.heart, liked ? styles.heartLiked : null]}>
        {liked ? "♥" : "♡"}
      </Text>
      <Text style={styles.count}>{count}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: { flexDirection: "row", alignItems: "center", gap: 4 },
  heart: { fontSize: 16, color: "#71717a" },
  heartLiked: { color: "#e11d48" },
  count: { fontSize: 13, color: "#71717a", fontVariant: ["tabular-nums"] },
});
