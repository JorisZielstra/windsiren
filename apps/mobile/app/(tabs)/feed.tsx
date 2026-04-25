import { Link, router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
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
  fetchPersonalFeed,
  getCommentCounts,
  getLikeCounts,
  getLikedSessionIds,
  getPhotosForSessions,
  getPhotoPublicUrl,
  getPublicProfiles,
  type FeedItem,
  type PublicProfile,
} from "@windsiren/core";
import { SessionCard } from "../../components/SessionCard";
import { useAuth } from "../../lib/auth-context";
import { relativeTime } from "../../lib/relative-time";
import { supabase } from "../../lib/supabase";

type Enriched = {
  items: FeedItem[];
  profiles: Map<string, PublicProfile>;
  spots: Map<string, { name: string; slug: string }>;
  likeCounts: Map<string, number>;
  likedIds: Set<string>;
  photoUrls: Map<string, string[]>;
  commentCounts: Map<string, number>;
};

export default function FeedScreen() {
  const { user, loading: authLoading } = useAuth();
  const [loaded, setLoaded] = useState<Enriched | null>(null);

  // Bounce to sign-in if anon once we know the auth state.
  useFocusEffect(
    useCallback(() => {
      if (!authLoading && !user) {
        router.replace("/sign-in");
      }
    }, [authLoading, user]),
  );

  useFocusEffect(
    useCallback(() => {
      if (!user) return;
      let cancelled = false;
      (async () => {
        setLoaded(null);
        const items = await fetchPersonalFeed(supabase, user.id, { limit: 50, includeSelf: true });
        const authorIds = Array.from(new Set(items.map((i) => i.userId)));
        const spotIds = Array.from(new Set(items.map((i) => i.spotId)));
        const sessionIds = items.filter((i) => i.type === "session").map((i) => i.session.id);
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
        const spots = new Map<string, { name: string; slug: string }>();
        for (const s of spotRes.data ?? []) spots.set(s.id, { name: s.name, slug: s.slug });
        const photoUrls = new Map<string, string[]>();
        for (const [sid, photos] of photosBySession) {
          photoUrls.set(sid, photos.map((p) => getPhotoPublicUrl(supabase, p.storage_path)));
        }
        if (!cancelled)
          setLoaded({ items, profiles, spots, likeCounts, likedIds, photoUrls, commentCounts });
      })();
      return () => {
        cancelled = true;
      };
    }, [user]),
  );

  if (!user) {
    return null; // redirect is in flight
  }

  return (
    <SafeAreaView style={styles.container} edges={["bottom"]}>
      {!loaded ? (
        <ActivityIndicator style={styles.loader} size="large" />
      ) : loaded.items.length === 0 ? (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyTitle}>Your feed is empty.</Text>
          <Text style={styles.emptyBody}>
            Follow other kiters on a spot page to see their activity here.
          </Text>
        </View>
      ) : (
        <FlatList
          data={loaded.items}
          contentContainerStyle={styles.listContent}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          keyExtractor={(item) =>
            item.type === "session" ? `s:${item.session.id}` : `r:${item.rsvp.id}`
          }
          renderItem={({ item }) => (
            <Row
              item={item}
              authorName={loaded.profiles.get(item.userId)?.display_name ?? "Someone"}
              spot={loaded.spots.get(item.spotId)}
              likeCount={
                item.type === "session" ? loaded.likeCounts.get(item.session.id) ?? 0 : 0
              }
              liked={item.type === "session" && loaded.likedIds.has(item.session.id)}
              photoUrls={
                item.type === "session" ? loaded.photoUrls.get(item.session.id) ?? [] : []
              }
              commentCount={
                item.type === "session" ? loaded.commentCounts.get(item.session.id) ?? 0 : 0
              }
            />
          )}
        />
      )}
    </SafeAreaView>
  );
}

function Row({
  item,
  authorName,
  spot,
  likeCount,
  liked,
  photoUrls,
  commentCount,
}: {
  item: FeedItem;
  authorName: string;
  spot: { name: string; slug: string } | undefined;
  likeCount: number;
  liked: boolean;
  photoUrls: string[];
  commentCount: number;
}) {
  if (item.type === "session") {
    return (
      <SessionCard
        session={item.session}
        authorId={item.userId}
        authorName={authorName}
        spot={spot ?? null}
        createdAtRelative={relativeTime(item.createdAt)}
        photoUrls={photoUrls}
        likeCount={likeCount}
        liked={liked}
        commentCount={commentCount}
      />
    );
  }
  const r = item.rsvp;
  return (
    <View style={styles.row}>
      <Text style={styles.rowText}>
        <AuthorLink userId={item.userId} name={authorName} /> is going to{" "}
        {spot ? <SpotLink slug={spot.slug} name={spot.name} /> : <Text>Unknown spot</Text>} on{" "}
        <Text style={styles.semibold}>
          {new Date(r.planned_date).toLocaleDateString("en-NL", {
            weekday: "long",
            month: "short",
            day: "numeric",
          })}
        </Text>
      </Text>
      <Text style={styles.rowTimestamp}>{relativeTime(item.createdAt)}</Text>
    </View>
  );
}

function AuthorLink({ userId, name }: { userId: string; name: string }) {
  return (
    <Link href={`/users/${userId}`} asChild>
      <Pressable>
        <Text style={styles.link}>{name}</Text>
      </Pressable>
    </Link>
  );
}

function SpotLink({ slug, name }: { slug: string; name: string }) {
  return (
    <Link href={`/spots/${slug}`} asChild>
      <Pressable>
        <Text style={styles.link}>{name}</Text>
      </Pressable>
    </Link>
  );
}


const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fafafa" },
  loader: { flex: 1, marginTop: 48 },
  emptyBox: { margin: 20, padding: 24, borderWidth: 1, borderColor: "#e5e5e5", borderRadius: 8, alignItems: "center", backgroundColor: "#fff" },
  emptyTitle: { fontSize: 15, fontWeight: "600" },
  emptyBody: { marginTop: 6, fontSize: 13, color: "#6b7280", textAlign: "center" },
  listContent: { padding: 16 },
  separator: { height: 12 },
  row: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderColor: "#e4e4e7",
    borderWidth: 1,
    borderRadius: 8,
    backgroundColor: "#fff",
  },
  rowText: { fontSize: 14, color: "#18181b", lineHeight: 20 },
  rowTimestamp: { marginTop: 4, fontSize: 11, color: "#6b7280" },
  link: { color: "#0369a1", fontWeight: "600" },
  semibold: { fontWeight: "600" },
});
