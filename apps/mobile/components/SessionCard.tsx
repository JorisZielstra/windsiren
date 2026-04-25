import { Link } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Svg, { Circle, Line } from "react-native-svg";
import { needleEndpoint } from "@windsiren/core";
import { cardinalDirection, msToKnots } from "@windsiren/shared";
import type { SessionRow } from "@windsiren/supabase";
import { CommentSection } from "./CommentSection";
import { LikeButton } from "./LikeButton";
import { PhotoGrid } from "./PhotoGrid";

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
        <Text style={styles.timestamp}>{createdAtRelative}</Text>
      </View>
      <Text style={styles.dateLine}>{dateLabel}</Text>

      <SessionWindHero session={session} />

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

function SessionWindHero({
  session,
}: {
  session: Pick<
    SessionRow,
    "wind_avg_ms" | "wind_max_ms" | "wind_dir_avg_deg" | "gust_max_ms" | "duration_minutes"
  >;
}) {
  const dur = session.duration_minutes;
  if (session.wind_avg_ms == null) {
    return (
      <View style={styles.heroFallback}>
        <Text style={styles.heroFallbackNumber}>{dur}</Text>
        <Text style={styles.heroFallbackUnit}>min</Text>
        <Text style={styles.heroFallbackEmpty}>no wind data</Text>
      </View>
    );
  }
  const avgKn = Math.round(msToKnots(session.wind_avg_ms));
  const gustKn =
    session.gust_max_ms != null ? Math.round(msToKnots(session.gust_max_ms)) : null;
  const dirDeg = session.wind_dir_avg_deg;
  const dirLabel = dirDeg != null ? cardinalDirection(dirDeg) : null;

  return (
    <View style={styles.hero}>
      <View style={styles.heroCol}>
        <View style={styles.heroNumberRow}>
          <Text style={[styles.heroNumber, styles.heroAccent]}>{avgKn}</Text>
          <Text style={styles.heroUnit}>kn</Text>
        </View>
        <Text style={styles.heroLabel}>AVG</Text>
      </View>

      {gustKn !== null ? (
        <View style={styles.heroCol}>
          <View style={styles.heroNumberRow}>
            <Text style={styles.heroNumber}>{gustKn}</Text>
            <Text style={styles.heroUnit}>kn</Text>
          </View>
          <Text style={styles.heroLabel}>GUST</Text>
        </View>
      ) : null}

      {dirDeg != null && dirLabel ? (
        <View style={styles.heroDirCol}>
          <DirectionNeedle directionDeg={dirDeg} size={40} />
          <View style={styles.heroDirText}>
            <Text style={styles.heroDirLabel}>{dirLabel}</Text>
            <Text style={styles.heroDirDeg}>{Math.round(dirDeg)}°</Text>
          </View>
        </View>
      ) : null}

      <View style={[styles.heroCol, styles.heroDur]}>
        <View style={styles.heroNumberRow}>
          <Text style={styles.heroNumber}>{dur}</Text>
          <Text style={styles.heroUnit}>min</Text>
        </View>
        <Text style={styles.heroLabel}>DURATION</Text>
      </View>
    </View>
  );
}

function DirectionNeedle({
  directionDeg,
  size,
}: {
  directionDeg: number;
  size: number;
}) {
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 2;
  const tip = needleEndpoint(cx, cy, r - 3, directionDeg);
  return (
    <Svg width={size} height={size}>
      <Circle cx={cx} cy={cy} r={r} fill="#fafafa" stroke="#e4e4e7" strokeWidth={1} />
      {[0, 90, 180, 270].map((deg) => {
        const inner = cy - r + 2;
        const tickEnd = cy - r + 5;
        return (
          <Line
            key={deg}
            x1={cx}
            y1={inner}
            x2={cx}
            y2={tickEnd}
            stroke="#d4d4d8"
            strokeWidth={1}
            origin={`${cx}, ${cy}`}
            rotation={deg}
          />
        );
      })}
      <Line
        x1={cx}
        y1={cy}
        x2={tip.x}
        y2={tip.y}
        stroke="#059669"
        strokeWidth={2}
        strokeLinecap="round"
      />
      <Circle cx={tip.x} cy={tip.y} r={2} fill="#059669" />
      <Circle cx={cx} cy={cy} r={1.5} fill="#a1a1aa" />
    </Svg>
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
  hero: {
    flexDirection: "row",
    alignItems: "flex-end",
    flexWrap: "wrap",
    gap: 16,
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 12,
  },
  heroCol: {},
  heroDur: { marginLeft: "auto" },
  heroNumberRow: { flexDirection: "row", alignItems: "baseline" },
  heroNumber: {
    fontSize: 28,
    fontWeight: "700",
    color: "#18181b",
    fontVariant: ["tabular-nums"],
    lineHeight: 30,
  },
  heroAccent: { color: "#059669" },
  heroUnit: { fontSize: 12, color: "#71717a", marginLeft: 3 },
  heroLabel: {
    fontSize: 9,
    fontWeight: "600",
    letterSpacing: 0.6,
    color: "#71717a",
    marginTop: 3,
  },
  heroDirCol: { flexDirection: "row", alignItems: "center", gap: 6 },
  heroDirText: {},
  heroDirLabel: {
    fontSize: 16,
    fontWeight: "700",
    color: "#18181b",
    fontVariant: ["tabular-nums"],
  },
  heroDirDeg: { fontSize: 9, fontWeight: "600", letterSpacing: 0.6, color: "#71717a" },
  heroFallback: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 6,
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 12,
  },
  heroFallbackNumber: {
    fontSize: 28,
    fontWeight: "700",
    color: "#18181b",
    fontVariant: ["tabular-nums"],
  },
  heroFallbackUnit: { fontSize: 13, color: "#71717a" },
  heroFallbackEmpty: { fontSize: 11, color: "#a1a1aa", marginLeft: "auto" },
  notes: {
    paddingHorizontal: 12,
    paddingBottom: 10,
    fontSize: 13,
    color: "#3f3f46",
    lineHeight: 18,
  },
  photos: { paddingHorizontal: 12, paddingBottom: 10 },
  reactions: {
    borderTopColor: "#f4f4f5",
    borderTopWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
});
