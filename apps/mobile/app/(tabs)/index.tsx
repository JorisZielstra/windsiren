import { Link, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { msToKnots } from "@windsiren/shared";
import {
  dbRowToSpot,
  fetchFavoriteSpotIds,
  fetchHomeSpotIds,
  fetchPersonalFeed,
  fetchSpotWeek,
  getCommentCounts,
  getFriendsOnWaterToday,
  getLikeCounts,
  getLikedSessionIds,
  getPhotosForSessions,
  getPhotoPublicUrl,
  getPublicProfiles,
  peakWindMs,
  pickHeroSpot,
  type FeedItem,
  type FriendsOnWaterToday,
  type PublicProfile,
  type SpotWeek,
  type SpotWithVerdict,
} from "@windsiren/core";
import { SessionCard } from "../../components/SessionCard";
import { TodayDashboard } from "../../components/TodayDashboard";
import { VerdictPill } from "../../components/VerdictPill";
import { useAuth } from "../../lib/auth-context";
import { relativeTime } from "../../lib/relative-time";
import { supabase } from "../../lib/supabase";

type FeedData = {
  items: FeedItem[];
  profiles: Map<string, PublicProfile>;
  spots: Map<string, { name: string; slug: string }>;
  likeCounts: Map<string, number>;
  likedIds: Set<string>;
  photoUrls: Map<string, string[]>;
  commentCounts: Map<string, number>;
};

export default function SpotsListScreen() {
  const { user } = useAuth();
  const [spotWeeks, setSpotWeeks] = useState<SpotWeek[] | null>(null);
  const [items, setItems] = useState<SpotWithVerdict[] | null>(null);
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  const [homeSpotIds, setHomeSpotIds] = useState<Set<string>>(new Set());
  const [friendsToday, setFriendsToday] = useState<FriendsOnWaterToday>({
    count: 0,
    profiles: [],
  });
  const [feed, setFeed] = useState<FeedData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [otherOpen, setOtherOpen] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        setError(null);
        const { data: rows, error: dbErr } = await supabase
          .from("spots")
          .select("*")
          .eq("active", true)
          .order("name");
        if (cancelled) return;
        if (dbErr) {
          setError(dbErr.message);
          return;
        }
        const spots = (rows ?? []).map(dbRowToSpot);
        const todayKey = nlLocalDateKey(new Date());
        const [weeks, favIds, homeIds, friends] = await Promise.all([
          Promise.all(spots.map((s) => fetchSpotWeek(s, 7))),
          user ? fetchFavoriteSpotIds(supabase, user.id) : Promise.resolve(new Set<string>()),
          user ? fetchHomeSpotIds(supabase, user.id) : Promise.resolve(new Set<string>()),
          user
            ? getFriendsOnWaterToday(supabase, user.id, todayKey)
            : Promise.resolve({ count: 0, profiles: [] } as FriendsOnWaterToday),
        ]);
        if (cancelled) return;
        // Today's verdicts derived from the partitioned week (used by the
        // spot list under the dashboard).
        const todayItems: SpotWithVerdict[] = weeks.map((week) => {
          const today = week.days.find((d) => d.dateKey === todayKey) ?? week.days[0];
          return {
            spot: week.spot,
            verdict: today?.verdict ?? null,
            hours: today?.hours ?? [],
          };
        });
        setSpotWeeks(weeks);
        setItems(todayItems);
        setFavoriteIds(favIds);
        setHomeSpotIds(homeIds);
        setFriendsToday(friends);

        if (user) {
          const feedItems = await fetchPersonalFeed(supabase, user.id, {
            limit: 5,
            includeSelf: true,
          });
          if (cancelled) return;
          const sessionIds = feedItems.filter((i) => i.type === "session").map((i) => i.session.id);
          const authorIds = Array.from(new Set(feedItems.map((i) => i.userId)));
          const spotIds = Array.from(new Set(feedItems.map((i) => i.spotId)));
          const [profiles, spotRes, likeCounts, likedIds, photosBySession, commentCounts] =
            await Promise.all([
              getPublicProfiles(supabase, authorIds),
              spotIds.length > 0
                ? supabase.from("spots").select("id, name, slug").in("id", spotIds)
                : Promise.resolve({ data: [] as { id: string; name: string; slug: string }[] }),
              getLikeCounts(supabase, sessionIds),
              getLikedSessionIds(supabase, user.id, sessionIds),
              getPhotosForSessions(supabase, sessionIds),
              getCommentCounts(supabase, sessionIds),
            ]);
          if (cancelled) return;
          const spotMap = new Map<string, { name: string; slug: string }>();
          for (const s of spotRes.data ?? []) spotMap.set(s.id, { name: s.name, slug: s.slug });
          const photoUrls = new Map<string, string[]>();
          for (const [sid, photos] of photosBySession) {
            photoUrls.set(sid, photos.map((p) => getPhotoPublicUrl(supabase, p.storage_path)));
          }
          setFeed({
            items: feedItems,
            profiles,
            spots: spotMap,
            likeCounts,
            likedIds,
            photoUrls,
            commentCounts,
          });
        } else {
          setFeed(null);
        }
      })();
      return () => {
        cancelled = true;
      };
    }, [user]),
  );

  // Best across all NL today — anchors the "Other spots" collapsible exclusion.
  const bestSpot = pickHeroSpot(items ?? []);
  // Other spots, in priority order. A spot only appears once: home > favorite > rest.
  const restHomeSpots = (items ?? []).filter(
    (i) => i.spot.id !== bestSpot?.spot.id && homeSpotIds.has(i.spot.id),
  );
  const restFavorites = (items ?? []).filter(
    (i) =>
      i.spot.id !== bestSpot?.spot.id &&
      favoriteIds.has(i.spot.id) &&
      !homeSpotIds.has(i.spot.id),
  );
  const restNonFavorites = (items ?? []).filter(
    (i) =>
      i.spot.id !== bestSpot?.spot.id &&
      !favoriteIds.has(i.spot.id) &&
      !homeSpotIds.has(i.spot.id),
  );
  const otherCount =
    restHomeSpots.length + restFavorites.length + restNonFavorites.length;
  const todayKey = nlLocalDateKey(new Date());

  return (
    <SafeAreaView style={styles.container} edges={["bottom"]}>
      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorTitle}>Something went wrong</Text>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : !items ? (
        <ActivityIndicator style={styles.loader} size="large" />
      ) : (
        <ScrollView contentContainerStyle={styles.scroll}>
          <View style={styles.dashboardWrap}>
            <TodayDashboard
              spotWeeks={spotWeeks ?? []}
              todayKey={todayKey}
              friendsCount={friendsToday.count}
              friendsPreview={friendsToday.profiles}
              signedIn={!!user}
              homeSpotIds={homeSpotIds}
            />
          </View>

          {otherCount > 0 ? (
            <View style={styles.otherSection}>
              <Pressable
                onPress={() => setOtherOpen((o) => !o)}
                style={styles.otherHeader}
              >
                <Text style={styles.otherChevron}>{otherOpen ? "▾" : "▸"}</Text>
                <Text style={styles.otherTitle}>Other spots</Text>
                <Text style={styles.otherCount}>{otherCount}</Text>
              </Pressable>
              {otherOpen ? (
                <View style={styles.otherBody}>
                  {restHomeSpots.length > 0 ? (
                    <>
                      <Text style={[styles.subLabel, styles.subLabelHome]}>
                        🏠 Your home spots
                      </Text>
                      {restHomeSpots.map((item) => (
                        <SpotRow key={item.spot.id} item={item} />
                      ))}
                    </>
                  ) : null}
                  {restFavorites.length > 0 ? (
                    <>
                      <Text style={[styles.subLabel, restHomeSpots.length > 0 && styles.subLabelSpaced]}>
                        ★ Favorites
                      </Text>
                      {restFavorites.map((item) => (
                        <SpotRow key={item.spot.id} item={item} />
                      ))}
                    </>
                  ) : null}
                  {restNonFavorites.length > 0 ? (
                    <>
                      <Text style={[styles.subLabel, styles.subLabelSpaced]}>All NL spots</Text>
                      {restNonFavorites.map((item) => (
                        <SpotRow key={item.spot.id} item={item} />
                      ))}
                    </>
                  ) : null}
                </View>
              ) : null}
            </View>
          ) : null}

          {user ? (
            <View style={styles.feedSection}>
              <View style={styles.feedHeader}>
                <Text style={styles.feedTitle}>Your feed</Text>
                <Link href="/(tabs)/feed" asChild>
                  <Pressable>
                    <Text style={styles.feedViewAll}>View all →</Text>
                  </Pressable>
                </Link>
              </View>
              {!feed ? (
                <ActivityIndicator />
              ) : feed.items.length === 0 ? (
                <View style={styles.feedEmpty}>
                  <Text style={styles.feedEmptyText}>
                    Nothing yet. Follow other kiters on a spot page, or log a session to get the feed going.
                  </Text>
                </View>
              ) : (
                <View style={styles.feedList}>
                  {feed.items.map((item) => {
                    const authorName =
                      feed.profiles.get(item.userId)?.display_name ?? "Someone";
                    const spot = feed.spots.get(item.spotId) ?? null;
                    if (item.type === "session") {
                      return (
                        <SessionCard
                          key={`s:${item.session.id}`}
                          session={item.session}
                          authorId={item.userId}
                          authorName={authorName}
                          spot={spot}
                          createdAtRelative={relativeTime(item.createdAt)}
                          photoUrls={feed.photoUrls.get(item.session.id) ?? []}
                          likeCount={feed.likeCounts.get(item.session.id) ?? 0}
                          liked={feed.likedIds.has(item.session.id)}
                          commentCount={feed.commentCounts.get(item.session.id) ?? 0}
                        />
                      );
                    }
                    const r = item.rsvp;
                    return (
                      <View key={`r:${r.id}`} style={styles.rsvpCard}>
                        <Text style={styles.rsvpText}>
                          <Link href={`/users/${item.userId}`} asChild>
                            <Pressable>
                              <Text style={styles.linkText}>{authorName}</Text>
                            </Pressable>
                          </Link>{" "}
                          is going to{" "}
                          {spot ? (
                            <Link href={`/spots/${spot.slug}`} asChild>
                              <Pressable>
                                <Text style={styles.linkText}>{spot.name}</Text>
                              </Pressable>
                            </Link>
                          ) : (
                            <Text>Unknown spot</Text>
                          )}{" "}
                          on{" "}
                          <Text style={styles.semibold}>
                            {new Date(r.planned_date).toLocaleDateString("en-NL", {
                              weekday: "long",
                              month: "short",
                              day: "numeric",
                            })}
                          </Text>
                        </Text>
                        <Text style={styles.rsvpTime}>{relativeTime(item.createdAt)}</Text>
                      </View>
                    );
                  })}
                </View>
              )}
            </View>
          ) : null}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function SpotRow({ item }: { item: SpotWithVerdict }) {
  const peak = peakWindMs(item.hours);
  return (
    <Link href={`/spots/${item.spot.slug}`} asChild>
      <Pressable
        style={({ pressed }) => [styles.row, pressed ? styles.rowPressed : null]}
      >
        <View style={styles.rowMain}>
          <View style={styles.rowTitleLine}>
            <Text style={styles.rowTitle}>{item.spot.name}</Text>
            {item.spot.tideSensitive ? (
              <View style={styles.tideBadge}>
                <Text style={styles.tideBadgeText}>Tide</Text>
              </View>
            ) : null}
          </View>
          <Text style={styles.rowSub}>
            {item.spot.lat.toFixed(3)}°N, {item.spot.lng.toFixed(3)}°E
            {peak !== null ? `  ·  peak ${msToKnots(peak).toFixed(0)} kn` : ""}
          </Text>
        </View>
        <VerdictPill verdict={item.verdict} />
      </Pressable>
    </Link>
  );
}

function nlLocalDateKey(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Amsterdam",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  scroll: { paddingBottom: 24 },
  dashboardWrap: { paddingHorizontal: 16, paddingTop: 16 },
  loader: { marginTop: 48 },
  errorBox: {
    margin: 16,
    padding: 16,
    borderRadius: 8,
    backgroundColor: "#fef2f2",
    borderWidth: 1,
    borderColor: "#fecaca",
  },
  errorTitle: { fontWeight: "600", color: "#991b1b" },
  errorText: { marginTop: 4, color: "#7f1d1d", fontSize: 13 },
  otherSection: {
    marginTop: 16,
    marginHorizontal: 16,
    borderWidth: 1,
    borderColor: "#e4e4e7",
    borderRadius: 8,
    overflow: "hidden",
  },
  otherHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 10,
  },
  otherChevron: { fontSize: 14, color: "#a1a1aa" },
  otherTitle: { fontSize: 14, fontWeight: "600", color: "#18181b", flex: 1 },
  otherCount: { fontSize: 12, color: "#71717a", fontVariant: ["tabular-nums"] },
  otherBody: { borderTopColor: "#f4f4f5", borderTopWidth: 1, paddingBottom: 6 },
  subLabel: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.5,
    color: "#6b7280",
    textTransform: "uppercase",
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 6,
  },
  subLabelSpaced: { paddingTop: 16 },
  subLabelHome: { color: "#059669" },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#f0f0f0",
  },
  rowPressed: { backgroundColor: "#f4f4f5" },
  rowMain: { flex: 1 },
  rowTitleLine: { flexDirection: "row", alignItems: "center", gap: 8 },
  rowTitle: { fontSize: 15, fontWeight: "500" },
  rowSub: { fontSize: 12, color: "#6b7280", marginTop: 2 },
  tideBadge: {
    backgroundColor: "#dbeafe",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  tideBadgeText: { fontSize: 10, color: "#1e40af", fontWeight: "600" },
  feedSection: { marginTop: 24, paddingHorizontal: 16 },
  feedHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
    marginBottom: 10,
  },
  feedTitle: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.5,
    color: "#6b7280",
    textTransform: "uppercase",
  },
  feedViewAll: { fontSize: 12, color: "#71717a" },
  feedEmpty: {
    padding: 20,
    borderWidth: 1,
    borderColor: "#e4e4e7",
    borderRadius: 8,
  },
  feedEmptyText: { fontSize: 13, color: "#71717a", lineHeight: 18 },
  feedList: { gap: 12 },
  rsvpCard: {
    padding: 12,
    borderWidth: 1,
    borderColor: "#e4e4e7",
    borderRadius: 8,
    backgroundColor: "#fff",
  },
  rsvpText: { fontSize: 13, color: "#18181b", lineHeight: 19 },
  rsvpTime: { fontSize: 11, color: "#71717a", marginTop: 4 },
  linkText: { color: "#0369a1", fontWeight: "600" },
  semibold: { fontWeight: "600" },
});
