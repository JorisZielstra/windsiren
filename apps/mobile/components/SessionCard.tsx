import { Link } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { SessionRow } from "@windsiren/supabase";
import { CommentSection } from "./CommentSection";
import { LikeButton } from "./LikeButton";
import { PhotoGrid } from "./PhotoGrid";
import { SessionWindHero } from "./SessionWindHero";

type Props = {
  session: SessionRow;
  authorId: string;
  authorName: string;
  spot: { name: string; slug: string } | null;
  showAuthor?: boolean;
  showSpot?: boolean;
  createdAtRelative: string;
  photoUrls: string[];
  likeCount: number;
  liked: boolean;
  commentCount: number;
};

export function SessionCard({
  session,
  authorId,
  authorName,
  spot,
  showAuthor = true,
  showSpot = true,
  createdAtRelative,
  photoUrls,
  likeCount,
  liked,
  commentCount,
}: Props) {
  const dateLabel = new Date(session.session_date).toLocaleDateString("en-NL", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <View style={styles.headerLeft}>
          {showAuthor ? (
            <Link href={`/users/${authorId}`} asChild>
              <Pressable>
                <Text style={styles.author}>{authorName}</Text>
              </Pressable>
            </Link>
          ) : null}
          {showAuthor && showSpot && spot ? <Text style={styles.dot}> · </Text> : null}
          {showSpot && spot ? (
            <Link href={`/spots/${spot.slug}`} asChild>
              <Pressable>
                <Text style={styles.spot}>{spot.name}</Text>
              </Pressable>
            </Link>
          ) : null}
        </View>
        <Link href={`/sessions/${session.id}`} asChild>
          <Pressable>
            <Text style={styles.timestamp}>{createdAtRelative}</Text>
          </Pressable>
        </Link>
      </View>
      <Text style={styles.dateLine}>{dateLabel}</Text>

      <SessionWindHero session={session} />

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
        <LikeButton sessionId={session.id} initialCount={likeCount} initialLiked={liked} />
        <CommentSection sessionId={session.id} initialCount={commentCount} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#ffffff",
    borderColor: "#e4e4e7",
    borderWidth: 1,
    borderRadius: 8,
    overflow: "hidden",
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingHorizontal: 12,
    paddingTop: 10,
    gap: 8,
  },
  headerLeft: { flexDirection: "row", flexShrink: 1, alignItems: "center" },
  author: { fontSize: 14, fontWeight: "700", color: "#18181b" },
  spot: { fontSize: 14, fontWeight: "500", color: "#18181b" },
  dot: { fontSize: 14, color: "#a1a1aa" },
  timestamp: { fontSize: 11, color: "#71717a" },
  dateLine: { fontSize: 11, color: "#71717a", paddingHorizontal: 12, paddingTop: 1 },
  notes: {
    paddingHorizontal: 12,
    paddingBottom: 10,
    fontSize: 13,
    color: "#3f3f46",
    lineHeight: 18,
  },
  photos: { paddingHorizontal: 12, paddingBottom: 10 },
  jumpRow: { paddingHorizontal: 12, paddingBottom: 10, flexDirection: "row" },
  jumpChip: {
    flexDirection: "row",
    alignItems: "baseline",
    backgroundColor: "#ecfdf5",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  jumpChipLabel: { fontSize: 11, color: "#065f46", fontWeight: "500" },
  jumpChipValue: { fontSize: 11, color: "#065f46", fontWeight: "700", fontVariant: ["tabular-nums"] },
  reactions: {
    borderTopColor: "#f4f4f5",
    borderTopWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
});
