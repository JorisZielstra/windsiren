import { Link, router, Stack, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  deleteSession,
  getCommentCounts,
  getLikeCounts,
  getLikedSessionIds,
  getPhotosForSessions,
  getPhotoPublicUrl,
  getPublicProfile,
  getSession,
  type PublicProfile,
} from "@windsiren/core";
import type { SessionRow } from "@windsiren/supabase";
import { CommentSection } from "../../components/CommentSection";
import { LikeButton } from "../../components/LikeButton";
import { PhotoGrid } from "../../components/PhotoGrid";
import { SessionWindHero } from "../../components/SessionWindHero";
import { useAuth } from "../../lib/auth-context";
import { relativeTime } from "../../lib/relative-time";
import { supabase } from "../../lib/supabase";

type Loaded = {
  session: SessionRow;
  author: PublicProfile | null;
  spot: { name: string; slug: string } | null;
  photoUrls: string[];
  likeCount: number;
  liked: boolean;
  commentCount: number;
};

export default function SessionDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  function confirmDelete(returnTo: string) {
    Alert.alert(
      "Delete this session?",
      "This cannot be undone — comments, likes, and photos go with it.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            setDeleting(true);
            const result = await deleteSession(supabase, id);
            setDeleting(false);
            if (!result.ok) {
              Alert.alert(
                "Couldn't delete",
                result.message ?? "Try again in a moment.",
              );
              return;
            }
            router.replace(returnTo);
          },
        },
      ],
    );
  }

  useEffect(() => {
    let cancelled = false;
    setLoaded(null);
    setError(null);
    (async () => {
      try {
        const session = await getSession(supabase, id);
        if (cancelled) return;
        if (!session) {
          setError("Session not found");
          return;
        }

        const [author, spotRes, photosBySession, likeCounts, likedIds, commentCounts] =
          await Promise.all([
            getPublicProfile(supabase, session.user_id),
            supabase
              .from("spots")
              .select("id, name, slug")
              .eq("id", session.spot_id)
              .maybeSingle(),
            getPhotosForSessions(supabase, [session.id]),
            getLikeCounts(supabase, [session.id]),
            user
              ? getLikedSessionIds(supabase, user.id, [session.id])
              : Promise.resolve(new Set<string>()),
            getCommentCounts(supabase, [session.id]),
          ]);

        const spot = spotRes.data
          ? { name: spotRes.data.name, slug: spotRes.data.slug }
          : null;
        const photoUrls = (photosBySession.get(session.id) ?? []).map((p) =>
          getPhotoPublicUrl(supabase, p.storage_path),
        );

        if (!cancelled)
          setLoaded({
            session,
            author,
            spot,
            photoUrls,
            likeCount: likeCounts.get(session.id) ?? 0,
            liked: likedIds.has(session.id),
            commentCount: commentCounts.get(session.id) ?? 0,
          });
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, user]);

  if (error) {
    return (
      <SafeAreaView style={styles.container} edges={["bottom"]}>
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      </SafeAreaView>
    );
  }
  if (!loaded) {
    return (
      <SafeAreaView style={styles.container} edges={["bottom"]}>
        <ActivityIndicator style={styles.loader} size="large" />
      </SafeAreaView>
    );
  }

  const { session, author, spot, photoUrls, likeCount, liked, commentCount } = loaded;
  const dateLabel = new Date(session.session_date).toLocaleDateString("en-NL", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  return (
    <SafeAreaView style={styles.container} edges={["bottom"]}>
      <Stack.Screen options={{ title: author?.display_name ?? "Session" }} />
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.card}>
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <Link href={`/users/${session.user_id}`} asChild>
                <Pressable>
                  <Text style={styles.author}>
                    {author?.display_name ?? "Someone"}
                  </Text>
                </Pressable>
              </Link>
              {spot ? (
                <View style={styles.spotLine}>
                  <Text style={styles.spotPrefix}>at </Text>
                  <Link href={`/spots/${spot.slug}`} asChild>
                    <Pressable>
                      <Text style={styles.spotName}>{spot.name}</Text>
                    </Pressable>
                  </Link>
                </View>
              ) : null}
            </View>
            <View style={styles.headerRight}>
              <Text style={styles.headerDate}>{dateLabel}</Text>
              <Text style={styles.headerPosted}>
                posted {relativeTime(session.created_at)}
              </Text>
              {user?.id === session.user_id ? (
                <Pressable
                  onPress={() =>
                    confirmDelete(spot ? `/spots/${spot.slug}` : "/")
                  }
                  disabled={deleting}
                  style={styles.deleteBtn}
                >
                  <Text style={[styles.deleteText, deleting && { opacity: 0.5 }]}>
                    {deleting ? "Deleting…" : "Delete"}
                  </Text>
                </Pressable>
              ) : null}
            </View>
          </View>

          <SessionWindHero session={session} size="detail" />

          {session.max_jump_m != null ? (
            <View style={styles.jumpRow}>
              <View style={styles.jumpChip}>
                <Text style={styles.jumpChipLabel}>Highest jump </Text>
                <Text style={styles.jumpChipValue}>{session.max_jump_m.toFixed(1)} m</Text>
              </View>
            </View>
          ) : null}

          {session.notes ? <Text style={styles.notes}>{session.notes}</Text> : null}

          {photoUrls.length > 0 ? (
            <View style={styles.photos}>
              <PhotoGrid urls={photoUrls} />
            </View>
          ) : null}

          <View style={styles.reactions}>
            <LikeButton
              sessionId={session.id}
              initialCount={likeCount}
              initialLiked={liked}
            />
            <CommentSection
              sessionId={session.id}
              initialCount={commentCount}
              defaultOpen
            />
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fafafa" },
  loader: { flex: 1, marginTop: 48 },
  scroll: { padding: 16 },
  errorBox: {
    margin: 20,
    padding: 24,
    borderWidth: 1,
    borderColor: "#fecaca",
    borderRadius: 8,
    backgroundColor: "#fff",
  },
  errorText: { fontSize: 14, color: "#b91c1c" },
  card: {
    backgroundColor: "#fff",
    borderColor: "#e4e4e7",
    borderWidth: 1,
    borderRadius: 8,
    overflow: "hidden",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    padding: 16,
    gap: 12,
  },
  headerLeft: { flexShrink: 1 },
  author: { fontSize: 22, fontWeight: "700", color: "#18181b" },
  spotLine: { flexDirection: "row", alignItems: "center", marginTop: 4 },
  spotPrefix: { fontSize: 13, color: "#71717a" },
  spotName: { fontSize: 13, fontWeight: "600", color: "#18181b" },
  headerRight: { alignItems: "flex-end" },
  deleteBtn: { marginTop: 8 },
  deleteText: { fontSize: 11, color: "#b91c1c", fontWeight: "600" },
  headerDate: { fontSize: 11, color: "#71717a" },
  headerPosted: { fontSize: 11, color: "#a1a1aa", marginTop: 2 },
  notes: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    fontSize: 14,
    color: "#3f3f46",
    lineHeight: 20,
  },
  photos: { paddingHorizontal: 16, paddingBottom: 16 },
  jumpRow: { paddingHorizontal: 16, paddingBottom: 16, flexDirection: "row" },
  jumpChip: {
    flexDirection: "row",
    alignItems: "baseline",
    backgroundColor: "#ecfdf5",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  jumpChipLabel: { fontSize: 13, color: "#065f46", fontWeight: "500" },
  jumpChipValue: { fontSize: 13, color: "#065f46", fontWeight: "700", fontVariant: ["tabular-nums"] },
  reactions: {
    borderTopColor: "#f4f4f5",
    borderTopWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
});
