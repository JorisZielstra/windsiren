import { Link } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { msToKnots } from "@windsiren/shared";
import type { UserStats } from "@windsiren/core";

type Props = {
  stats: UserStats;
  topSpotName: string | null;
  topSpotSlug: string | null;
};

export function UserStatsPanel({ stats, topSpotName, topSpotSlug }: Props) {
  if (stats.sessionCount === 0) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>
          No stats yet — log a session to start the leaderboard.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.grid}>
      <Stat label="Sessions" value={stats.sessionCount.toString()} />
      <Stat label="Total time" value={formatHours(stats.totalMinutes)} />
      <Stat
        label="Longest"
        value={
          stats.longestSessionMinutes != null
            ? formatHours(stats.longestSessionMinutes)
            : "—"
        }
      />
      <Stat
        label="Highest jump"
        value={stats.biggestJumpM != null ? `${stats.biggestJumpM.toFixed(1)} m` : "—"}
        accent={stats.biggestJumpM != null}
      />
      <Stat
        label="Strongest gust"
        value={
          stats.biggestGustMs != null
            ? `${Math.round(msToKnots(stats.biggestGustMs))} kn`
            : "—"
        }
      />
      <TopSpotStat
        name={topSpotName}
        slug={topSpotSlug}
        sessionCount={stats.topSpot?.sessionCount ?? null}
      />
    </View>
  );
}

function Stat({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <View style={styles.cell}>
      <Text style={styles.label}>{label.toUpperCase()}</Text>
      <Text style={[styles.value, accent && styles.accent]}>{value}</Text>
    </View>
  );
}

function TopSpotStat({
  name,
  slug,
  sessionCount,
}: {
  name: string | null;
  slug: string | null;
  sessionCount: number | null;
}) {
  if (!name || !slug) {
    return (
      <View style={styles.cell}>
        <Text style={styles.label}>TOP SPOT</Text>
        <Text style={styles.value}>—</Text>
      </View>
    );
  }
  return (
    <Link href={`/spots/${slug}`} asChild>
      <Pressable style={styles.cell}>
        <Text style={styles.label}>TOP SPOT</Text>
        <Text style={[styles.value, styles.spotName]} numberOfLines={1}>
          {name}
        </Text>
        {sessionCount != null ? (
          <Text style={styles.sub}>
            {sessionCount} session{sessionCount === 1 ? "" : "s"}
          </Text>
        ) : null}
      </Pressable>
    </Link>
  );
}

function formatHours(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const hours = minutes / 60;
  if (hours < 10) return `${hours.toFixed(1)} h`;
  return `${Math.round(hours)} h`;
}

const styles = StyleSheet.create({
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  cell: {
    flexBasis: "47%",
    flexGrow: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: "#e4e4e7",
    borderRadius: 8,
    backgroundColor: "#fff",
  },
  label: {
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 0.6,
    color: "#71717a",
  },
  value: {
    fontSize: 18,
    fontWeight: "700",
    color: "#18181b",
    fontVariant: ["tabular-nums"],
    marginTop: 4,
  },
  accent: { color: "#059669" },
  spotName: { fontSize: 16 },
  sub: { fontSize: 10, color: "#71717a", marginTop: 2 },
  empty: {
    paddingHorizontal: 16,
    paddingVertical: 24,
    borderWidth: 1,
    borderColor: "#e4e4e7",
    borderRadius: 8,
    alignItems: "center",
  },
  emptyText: { fontSize: 13, color: "#71717a", textAlign: "center" },
});
