import { Link } from "expo-router";
import React, { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import {
  type PublicProfile,
  type SpotWeek,
  type SpotWithVerdict,
} from "@windsiren/core";
import type { HourlyForecast } from "@windsiren/shared";
import { countRideable } from "./dashboard-utils";
import {
  AirTempTile,
  DaylightTile,
  PeakWindowTile,
  Tile,
  TrendTile,
  WindTile,
} from "./DayTiles";
import { TileModal, type TileKey } from "./TileModal";
import { WeekStrip } from "./WeekStrip";

type Props = {
  spotWeeks: SpotWeek[];
  todayKey: string;
  friendsCount: number;
  friendsPreview: PublicProfile[];
  signedIn: boolean;
  homeSpotIds: Set<string>;
};

export function TodayDashboard({
  spotWeeks,
  todayKey,
  friendsCount,
  friendsPreview,
  signedIn,
  homeSpotIds,
}: Props) {
  const personalized = signedIn && homeSpotIds.size > 0;
  const scopedSpotWeeks = useMemo(
    () =>
      personalized
        ? spotWeeks.filter((w) => homeSpotIds.has(w.spot.id))
        : spotWeeks,
    [spotWeeks, homeSpotIds, personalized],
  );

  const dateKeys = useMemo(() => collectDateKeys(scopedSpotWeeks), [scopedSpotWeeks]);
  const [selectedDate, setSelectedDate] = useState<string>(
    dateKeys.includes(todayKey) ? todayKey : (dateKeys[0] ?? todayKey),
  );
  const [activeTile, setActiveTile] = useState<TileKey | null>(null);

  const dayItems: SpotWithVerdict[] = useMemo(
    () =>
      scopedSpotWeeks.map((week) => {
        const day = week.days.find((d) => d.dateKey === selectedDate);
        return {
          spot: week.spot,
          verdict: day?.verdict ?? null,
          hours: day?.hours ?? [],
        };
      }),
    [scopedSpotWeeks, selectedDate],
  );

  const total = dayItems.length;
  const goCount = dayItems.filter((v) => v.verdict?.decision === "go").length;
  const dayScore = total > 0 ? Math.round((goCount / total) * 100) : 0;
  const dayLabel = labelForScore(dayScore);
  const scoreAccent = dayScore >= 40;

  const bestSpot = pickBestSpot(dayItems);
  const isToday = selectedDate === todayKey;
  const dateLabel = formatDateLabel(selectedDate, isToday);
  const weekScores = useMemo(
    () => buildWeekScores(scopedSpotWeeks, dateKeys),
    [scopedSpotWeeks, dateKeys],
  );

  return (
    <View style={styles.card}>
      <View style={styles.heroSection}>
        <View style={styles.heroTopRow}>
          <Text style={styles.todayBadge}>CONDITIONS SCORE</Text>
          <Text style={styles.todayDate}>{dateLabel}</Text>
        </View>

        {total === 0 ? (
          <Text style={styles.empty}>No spot data right now.</Text>
        ) : (
          <>
            <View style={styles.heroRow}>
              <View style={styles.scoreCol}>
                <Text style={[styles.scoreNum, scoreAccent && styles.scoreAccent]}>
                  {dayScore}
                </Text>
                <Text style={styles.scoreOutOf}> / 100</Text>
              </View>
              <View style={styles.scoreSummary}>
                <Text style={styles.scoreLabel}>{dayLabel}</Text>
                <Text style={styles.scoreSub}>
                  <Text style={styles.scoreSubBold}>{goCount}</Text>
                  {" "}of {total} {personalized ? "home spots" : "spots"} GO
                </Text>
                {bestSpot ? (
                  <Link href={`/spots/${bestSpot.spot.slug}`} asChild>
                    <Pressable>
                      <Text style={styles.bestLink}>
                        Best: {bestSpot.spot.name} · {countRideable(bestSpot)}h GO →
                      </Text>
                    </Pressable>
                  </Link>
                ) : null}
              </View>
            </View>

            <View style={styles.scoreBarTrack}>
              <View
                style={[
                  styles.scoreBarFill,
                  scoreAccent ? styles.scoreBarFillAccent : styles.scoreBarFillMuted,
                  { width: `${dayScore}%` },
                ]}
              />
            </View>
            <View style={styles.scoreFooterRow}>
              <Pressable onPress={() => setActiveTile("score")}>
                <Text style={styles.viewBreakdown}>View breakdown →</Text>
              </Pressable>
              {signedIn && homeSpotIds.size === 0 ? (
                <Text style={styles.scopeHint} numberOfLines={2}>
                  Open a spot to set it as a home spot
                </Text>
              ) : personalized ? (
                <Text style={styles.scopeHint}>
                  Personalized · {homeSpotIds.size} home
                  {homeSpotIds.size === 1 ? "" : "s"}
                </Text>
              ) : null}
            </View>
          </>
        )}
      </View>

      <WeekStrip
        dateKeys={dateKeys}
        weekScores={weekScores}
        selectedDate={selectedDate}
        todayKey={todayKey}
        onSelect={setSelectedDate}
      />

      <View style={styles.tileGrid}>
        <WindTile item={bestSpot} onPress={() => setActiveTile("wind")} />
        <AirTempTile item={bestSpot} onPress={() => setActiveTile("airTemp")} />
        {signedIn ? (
          <FriendsTile
            count={friendsCount}
            preview={friendsPreview}
            isToday={isToday}
            onPress={isToday ? () => setActiveTile("friends") : undefined}
          />
        ) : (
          <SignInTile />
        )}
        <PeakWindowTile
          dayItems={dayItems}
          item={bestSpot}
          onPress={() => setActiveTile("peakWindow")}
        />
        <DaylightTile item={bestSpot} selectedDate={selectedDate} />
        <TrendTile item={bestSpot} onPress={() => setActiveTile("trend")} />
      </View>

      <TileModal
        tile={activeTile}
        onClose={() => setActiveTile(null)}
        dayItems={dayItems}
        bestSpot={bestSpot}
        spotWeeks={spotWeeks}
        selectedDate={selectedDate}
        friends={{ count: friendsCount, profiles: friendsPreview }}
      />
    </View>
  );
}

// ---------------------------------------------------------------------------
// Tiles unique to the dashboard. Per-spot tiles live in DayTiles.tsx.
// ---------------------------------------------------------------------------

function FriendsTile({
  count,
  preview,
  isToday,
  onPress,
}: {
  count: number;
  preview: PublicProfile[];
  isToday: boolean;
  onPress?: () => void;
}) {
  if (!isToday) {
    return (
      <Tile label="FRIENDS" sub="today only">
        <Text style={[styles.tileValue, styles.tileMuted]}>—</Text>
      </Tile>
    );
  }
  const names = preview.slice(0, 2).map((p) => p.display_name ?? "Someone");
  const extra = Math.max(0, count - names.length);
  return (
    <Tile label="FRIENDS" sub="out today" onPress={onPress}>
      <Text style={[styles.tileValue, count > 0 && styles.tileAccent]}>{count}</Text>
      {names.length > 0 ? (
        <Text style={styles.tileSubSmall} numberOfLines={1}>
          {names.join(" · ")}
          {extra > 0 ? ` +${extra}` : ""}
        </Text>
      ) : null}
    </Tile>
  );
}

function SignInTile() {
  return (
    <Tile label="FRIENDS">
      <Link href="/sign-in" asChild>
        <Pressable>
          <Text style={styles.signInLink}>Sign in →</Text>
        </Pressable>
      </Link>
    </Tile>
  );
}

// ---------------------------------------------------------------------------
// Helpers used only by TodayDashboard (per-spot helpers live in dashboard-utils).
// ---------------------------------------------------------------------------

function collectDateKeys(spotWeeks: SpotWeek[]): string[] {
  const keys = new Set<string>();
  for (const w of spotWeeks) for (const d of w.days) keys.add(d.dateKey);
  return Array.from(keys).sort();
}

function buildWeekScores(
  spotWeeks: SpotWeek[],
  dateKeys: string[],
): Map<string, { score: number; goCount: number; total: number }> {
  const out = new Map<string, { score: number; goCount: number; total: number }>();
  for (const dateKey of dateKeys) {
    let goCount = 0;
    let total = 0;
    for (const week of spotWeeks) {
      const day = week.days.find((d) => d.dateKey === dateKey);
      if (!day) continue;
      total += 1;
      if (day.verdict?.decision === "go") goCount += 1;
    }
    const score = total > 0 ? Math.round((goCount / total) * 100) : 0;
    out.set(dateKey, { score, goCount, total });
  }
  return out;
}

function pickBestSpot(items: SpotWithVerdict[]): SpotWithVerdict | null {
  if (items.length === 0) return null;
  const score = (decision: "go" | "marginal" | "no_go" | undefined): number => {
    if (decision === "go") return 3;
    if (decision === "marginal") return 2;
    if (decision === "no_go") return 1;
    return 0;
  };
  let best = items[0]!;
  let bestPeak = peakOf(best.hours);
  for (const cur of items) {
    const cScore = score(cur.verdict?.decision);
    const bScore = score(best.verdict?.decision);
    if (cScore > bScore) {
      best = cur;
      bestPeak = peakOf(cur.hours);
      continue;
    }
    if (cScore === bScore) {
      const cPeak = peakOf(cur.hours);
      if (cPeak > bestPeak) {
        best = cur;
        bestPeak = cPeak;
      }
    }
  }
  return best;
}

function peakOf(hours: HourlyForecast[]): number {
  let max = 0;
  for (const h of hours) if (h.windSpeedMs > max) max = h.windSpeedMs;
  return max;
}

function labelForScore(score: number): string {
  if (score >= 70) return "Banger day";
  if (score >= 40) return "Solid day";
  if (score >= 20) return "Pockets of action";
  return "Mellow day";
}

function formatDateLabel(dateKey: string, isToday: boolean): string {
  const d = new Date(`${dateKey}T12:00:00Z`);
  const formatted = d.toLocaleDateString("en-NL", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "Europe/Amsterdam",
  });
  return isToday ? `Today · ${formatted}` : formatted;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#fff",
    borderColor: "#e4e4e7",
    borderWidth: 1,
    borderRadius: 12,
    overflow: "hidden",
  },
  heroSection: { padding: 16 },
  heroTopRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" },
  todayBadge: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1.5,
    color: "#71717a",
  },
  todayDate: { fontSize: 11, color: "#71717a" },
  empty: { marginTop: 16, fontSize: 13, color: "#71717a" },
  heroRow: { marginTop: 12, flexDirection: "row", alignItems: "flex-end", gap: 16 },
  scoreCol: { flexDirection: "row", alignItems: "baseline" },
  scoreNum: {
    fontSize: 48,
    fontWeight: "700",
    color: "#18181b",
    fontVariant: ["tabular-nums"],
    lineHeight: 50,
  },
  scoreAccent: { color: "#059669" },
  scoreOutOf: { fontSize: 13, color: "#71717a", marginLeft: 4 },
  scoreSummary: { flex: 1, paddingBottom: 4 },
  scoreLabel: { fontSize: 16, fontWeight: "600", color: "#18181b" },
  scoreSub: { fontSize: 13, color: "#71717a", marginTop: 2 },
  scoreSubBold: { color: "#18181b", fontWeight: "600", fontVariant: ["tabular-nums"] },
  bestLink: { fontSize: 13, color: "#059669", marginTop: 4 },
  scoreBarTrack: {
    marginTop: 14,
    height: 6,
    width: "100%",
    backgroundColor: "#f4f4f5",
    borderRadius: 999,
    overflow: "hidden",
  },
  scoreBarFill: { height: "100%" },
  scoreBarFillAccent: { backgroundColor: "#10b981" },
  scoreBarFillMuted: { backgroundColor: "#a1a1aa" },
  tileGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    borderTopColor: "#f4f4f5",
    borderTopWidth: 1,
  },
  viewBreakdown: { fontSize: 12, color: "#71717a" },
  scoreFooterRow: {
    marginTop: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  },
  scopeHint: { fontSize: 11, color: "#71717a", flexShrink: 1, textAlign: "right" },
  // Styles below are still used by the inline FriendsTile / SignInTile —
  // those reuse the per-spot Tile shell from DayTiles.tsx but render
  // dashboard-specific content.
  tileValue: {
    fontSize: 20,
    fontWeight: "700",
    color: "#18181b",
    fontVariant: ["tabular-nums"],
  },
  tileAccent: { color: "#059669" },
  tileMuted: { color: "#a1a1aa" },
  tileSubSmall: { fontSize: 10, color: "#71717a", marginTop: 2 },
  signInLink: { fontSize: 14, color: "#059669", fontWeight: "600" },
});
