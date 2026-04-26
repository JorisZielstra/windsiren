import { Link, router, Stack, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  followUser,
  getCommentCounts,
  getFollowCounts,
  getLikeCounts,
  getLikedSessionIds,
  getPhotosForSessions,
  getPhotoPublicUrl,
  getPublicProfile,
  getUserStats,
  isFollowing,
  listSessionsForUser,
  listUserRsvps,
  unfollowUser,
  type FollowCounts,
  type PublicProfile,
  type UserStats,
} from "@windsiren/core";
import type { RsvpRow, SessionRow } from "@windsiren/supabase";
import { Avatar } from "../../components/Avatar";
import { SessionCard } from "../../components/SessionCard";
import { UserStatsPanel } from "../../components/UserStatsPanel";
import { useAuth } from "../../lib/auth-context";
import { relativeTime } from "../../lib/relative-time";
import { supabase } from "../../lib/supabase";

type Loaded = {
  profile: PublicProfile;
  counts: FollowCounts;
  sessions: SessionRow[];
  upcomingRsvps: RsvpRow[];
  spotsById: Map<string, { name: string; slug: string }>;
  photoUrls: Map<string, string[]>;
  likeCounts: Map<string, number>;
  likedIds: Set<string>;
  commentCounts: Map<string, number>;
  stats: UserStats;
};

export default function UserProfileScreen() {
  const { userId } = useLocalSearchParams<{ userId: string }>();
  const { user } = useAuth();
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoaded(null);
    setError(null);
    (async () => {
      try {
        const [profile, counts, sessions, rsvps, stats] = await Promise.all([
          getPublicProfile(supabase, userId),
          getFollowCounts(supabase, userId),
          listSessionsForUser(supabase, userId, 20),
          listUserRsvps(supabase, userId, 20),
          getUserStats(supabase, userId),
        ]);
        if (cancelled) return;
        if (!profile) {
          setError("User not found");
          return;
        }

        const spotIds = Array.from(
          new Set([
            ...sessions.map((s) => s.spot_id),
            ...rsvps.map((r) => r.spot_id),
            ...(stats.topSpot ? [stats.topSpot.spotId] : []),
          ]),
        );
        const spotsById = new Map<string, { name: string; slug: string }>();
        if (spotIds.length > 0) {
          const { data: spotRows } = await supabase
            .from("spots")
            .select("id, name, slug")
            .in("id", spotIds);
          for (const s of spotRows ?? []) spotsById.set(s.id, { name: s.name, slug: s.slug });
        }

        const today = new Date().toISOString().slice(0, 10);
        const upcomingRsvps = rsvps.filter((r) => r.planned_date >= today);

        const sessionIds = sessions.map((s) => s.id);
        const [photosBySession, likeCounts, likedIds, commentCounts] = await Promise.all([
          getPhotosForSessions(supabase, sessionIds),
          getLikeCounts(supabase, sessionIds),
          user
            ? getLikedSessionIds(supabase, user.id, sessionIds)
            : Promise.resolve(new Set<string>()),
          getCommentCounts(supabase, sessionIds),
        ]);
        const photoUrls = new Map<string, string[]>();
        for (const [sid, photos] of photosBySession) {
          photoUrls.set(sid, photos.map((p) => getPhotoPublicUrl(supabase, p.storage_path)));
        }

        if (!cancelled)
          setLoaded({
            profile,
            counts,
            sessions,
            upcomingRsvps,
            spotsById,
            photoUrls,
            likeCounts,
            likedIds,
            commentCounts,
            stats,
          });
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, user]);

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

  const isSelf = user?.id === userId;

  return (
    <SafeAreaView style={styles.container} edges={["bottom"]}>
      <Stack.Screen options={{ title: loaded.profile.display_name ?? "Kiter" }} />
      <FlatList
        contentContainerStyle={{ paddingBottom: 24 }}
        ListHeaderComponent={
          <View>
            <View style={styles.header}>
              <View style={styles.headerTopRow}>
                <Avatar
                  url={loaded.profile.avatar_url}
                  name={loaded.profile.display_name}
                  size={72}
                />
                <View style={styles.headerText}>
                  <Text style={styles.name}>{loaded.profile.display_name ?? "Anonymous kiter"}</Text>
                  <Text style={styles.counts}>
                    <Text style={styles.countsNum}>{loaded.counts.followers}</Text> follower
                    {loaded.counts.followers === 1 ? "" : "s"} ·{" "}
                    <Text style={styles.countsNum}>{loaded.counts.following}</Text> following
                  </Text>
                </View>
              </View>
              {loaded.profile.bio ? <Text style={styles.bio}>{loaded.profile.bio}</Text> : null}
              <View style={{ marginTop: 12 }}>
                {isSelf ? (
                  <Link href="/profile-edit" asChild>
                    <Pressable style={styles.btnSecondary}>
                      <Text style={styles.btnSecondaryText}>Edit profile</Text>
                    </Pressable>
                  </Link>
                ) : user ? (
                  <FollowButton targetUserId={userId} />
                ) : (
                  <Pressable
                    style={styles.btnPrimary}
                    onPress={() => router.push("/sign-in")}
                  >
                    <Text style={styles.btnPrimaryText}>Sign in to follow</Text>
                  </Pressable>
                )}
              </View>
            </View>

            <Text style={styles.sectionLabel}>Stats</Text>
            <View style={styles.statsWrap}>
              <UserStatsPanel
                stats={loaded.stats}
                topSpotName={
                  loaded.stats.topSpot
                    ? loaded.spotsById.get(loaded.stats.topSpot.spotId)?.name ?? null
                    : null
                }
                topSpotSlug={
                  loaded.stats.topSpot
                    ? loaded.spotsById.get(loaded.stats.topSpot.spotId)?.slug ?? null
                    : null
                }
              />
            </View>

            {loaded.upcomingRsvps.length > 0 ? (
              <View>
                <Text style={styles.sectionLabel}>Upcoming RSVPs</Text>
                {loaded.upcomingRsvps.map((r) => {
                  const spot = loaded.spotsById.get(r.spot_id);
                  return (
                    <View key={r.id} style={styles.row}>
                      <Text style={styles.rowTitle}>{spot?.name ?? "Unknown spot"}</Text>
                      <Text style={styles.rowSub}>
                        {new Date(r.planned_date).toLocaleDateString("en-NL", {
                          weekday: "long",
                          month: "short",
                          day: "numeric",
                        })}
                      </Text>
                    </View>
                  );
                })}
              </View>
            ) : null}

            <Text style={[styles.sectionLabel, { marginTop: 16 }]}>Recent sessions</Text>
            {loaded.sessions.length === 0 ? (
              <Text style={styles.empty}>No sessions logged yet.</Text>
            ) : null}
          </View>
        }
        data={loaded.sessions}
        keyExtractor={(s) => s.id}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        renderItem={({ item }) => {
          const spot = loaded.spotsById.get(item.spot_id) ?? null;
          return (
            <View style={styles.cardWrap}>
              <SessionCard
                session={item}
                authorId={item.user_id}
                authorName={loaded.profile.display_name ?? "Someone"}
                spot={spot}
                showAuthor={false}
                createdAtRelative={relativeTime(item.created_at)}
                photoUrls={loaded.photoUrls.get(item.id) ?? []}
                likeCount={loaded.likeCounts.get(item.id) ?? 0}
                liked={loaded.likedIds.has(item.id)}
                commentCount={loaded.commentCounts.get(item.id) ?? 0}
              />
            </View>
          );
        }}
      />
    </SafeAreaView>
  );
}

function FollowButton({ targetUserId }: { targetUserId: string }) {
  const { user } = useAuth();
  const [following, setFollowing] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    isFollowing(supabase, user.id, targetUserId).then((v) => {
      if (!cancelled) setFollowing(v);
    });
    return () => {
      cancelled = true;
    };
  }, [user, targetUserId]);

  if (!user || following === null) {
    return <View style={{ height: 36 }} />;
  }

  async function toggle() {
    if (!user || busy) return;
    setBusy(true);
    const result = following
      ? await unfollowUser(supabase, user.id, targetUserId)
      : await followUser(supabase, user.id, targetUserId);
    setBusy(false);
    if (result.ok) setFollowing(result.following);
  }

  return (
    <Pressable
      onPress={toggle}
      disabled={busy}
      style={[following ? styles.btnSecondary : styles.btnPrimary, busy && { opacity: 0.6 }]}
    >
      <Text style={following ? styles.btnSecondaryText : styles.btnPrimaryText}>
        {following ? "Following" : "Follow"}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  loader: { flex: 1, marginTop: 48 },
  errorBox: { margin: 16, padding: 16, backgroundColor: "#fef2f2", borderRadius: 8 },
  errorText: { color: "#991b1b" },
  header: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 16, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "#e5e5e5" },
  headerTopRow: { flexDirection: "row", alignItems: "center", gap: 14 },
  headerText: { flex: 1 },
  name: { fontSize: 24, fontWeight: "700" },
  bio: { fontSize: 14, color: "#374151", marginTop: 6, lineHeight: 20 },
  counts: { marginTop: 10, fontSize: 13, color: "#6b7280" },
  countsNum: { color: "#111827", fontWeight: "600" },
  btnPrimary: { backgroundColor: "#18181b", paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, alignSelf: "flex-start" },
  btnPrimaryText: { color: "#fff", fontSize: 13, fontWeight: "600" },
  btnSecondary: { borderWidth: 1, borderColor: "#d4d4d8", paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, alignSelf: "flex-start" },
  btnSecondaryText: { color: "#18181b", fontSize: 13, fontWeight: "600" },
  sectionLabel: { fontSize: 10, fontWeight: "700", color: "#6b7280", textTransform: "uppercase", letterSpacing: 0.5, paddingHorizontal: 20, paddingTop: 16, paddingBottom: 6 },
  empty: { paddingHorizontal: 20, fontSize: 13, color: "#9ca3af" },
  row: { paddingHorizontal: 20, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "#f0f0f0" },
  rowTitle: { fontSize: 15, fontWeight: "500" },
  rowSub: { fontSize: 11, color: "#6b7280" },
  cardWrap: { paddingHorizontal: 16 },
  statsWrap: { paddingHorizontal: 16, paddingBottom: 8 },
  separator: { height: 12 },
});
