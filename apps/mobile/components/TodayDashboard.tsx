import { Link } from "expo-router";
import React, { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import {
  type PublicProfile,
  type SpotWeek,
  type SpotWithVerdict,
} from "@windsiren/core";
import { msToKnots, type HourlyForecast } from "@windsiren/shared";
import {
  addDaysToKey,
  countRideable,
  daylightHours,
  mondayOfDate,
  weekDates,
} from "./dashboard-utils";
import {
  AirTempTile,
  DaylightTile,
  PeakWindowTile,
  Tile,
  TrendTile,
  WindTile,
} from "./DayTiles";
import { HomeSpotsManager, type DashboardScope } from "./HomeSpotsManager";
import { TileModal, type TileKey } from "./TileModal";
import { WeekStrip, type WeekScoreEntry } from "./WeekStrip";

type Props = {
  spotWeeks: SpotWeek[];
  todayKey: string;
  friendsCount: number;
  friendsPreview: PublicProfile[];
  signedIn: boolean;
  homeSpotIds: Set<string>;
  prefsSummary?: string;
  // Bumped by the parent's data fetcher when home spots change so the
  // dashboard re-derives `scopedSpotWeeks` against the new set.
  onHomeSpotsMutated?: () => void;
};

export function TodayDashboard({
  spotWeeks,
  todayKey,
  friendsCount,
  friendsPreview,
  signedIn,
  homeSpotIds,
  prefsSummary,
  onHomeSpotsMutated,
}: Props) {
  const [scope, setScope] = useState<DashboardScope>("personalized");
  const personalized =
    signedIn && homeSpotIds.size > 0 && scope === "personalized";
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
  const scoreAccent = dayScore >= 40;

  const bestSpot = pickBestSpot(dayItems);

  // Hero stats track the *best* home spot, not an average across them —
  // matches the web dashboard. See TodayDashboard.tsx (web) for rationale.
  const heroWind = useMemo(
    () => (bestSpot ? averageWindAndGust([bestSpot]) : null),
    [bestSpot],
  );
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
                {heroWind ? (
                  <>
                    <View style={styles.windRow}>
                      <Text
                        style={[styles.scoreNum, scoreAccent && styles.scoreAccent]}
                      >
                        {heroWind.windKn}
                      </Text>
                      <Text style={styles.windSep}>/</Text>
                      <Text style={styles.gustNum}>{heroWind.gustKn}</Text>
                      <Text style={styles.scoreOutOf}> kn</Text>
                    </View>
                    <Text style={styles.windCaption}>wind speed and gusts</Text>
                  </>
                ) : (
                  <Text style={[styles.scoreNum, { color: "#a1a1aa" }]}>—</Text>
                )}
              </View>
              <View style={styles.scoreSummary}>
                {goCount > 0 ? (
                  <Pressable
                    onPress={() => setActiveTile("goSpots")}
                    style={({ pressed }) => [
                      styles.goPill,
                      pressed && { opacity: 0.85 },
                    ]}
                  >
                    <Text style={styles.goPillText}>
                      {goCount} spot{goCount === 1 ? "" : "s"} are GO! →
                    </Text>
                  </Pressable>
                ) : (
                  <Text style={styles.scoreSub}>
                    0 of {total} {personalized ? "home spots" : "spots"} GO
                  </Text>
                )}
                {bestSpot ? (
                  <Link href={`/spots/${bestSpot.spot.slug}`} asChild>
                    <Pressable>
                      <Text style={styles.bestLink}>
                        {bestSpot.spot.name} · {countRideable(bestSpot)}h GO →
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
              <View />
              {signedIn ? (
                <HomeSpotsManager
                  homeSpotIds={homeSpotIds}
                  allSpots={spotWeeks.map((w) => w.spot)}
                  scope={scope}
                  onScopeChange={setScope}
                  onMutated={() => onHomeSpotsMutated?.()}
                />
              ) : null}
            </View>
            {signedIn ? (
              <View style={styles.prefsRow}>
                <Text style={styles.prefsText} numberOfLines={1}>
                  GO threshold:{" "}
                  <Text style={styles.prefsTextValue}>
                    {prefsSummary ?? "min 15 kn"}
                  </Text>
                </Text>
                <Link href="/profile-prefs" asChild>
                  <Pressable hitSlop={8}>
                    <Text style={styles.prefsLink}>Edit →</Text>
                  </Pressable>
                </Link>
              </View>
            ) : null}
          </>
        )}
      </View>

      <WeekStrip
        visibleDates={weekDates(mondayOfDate(selectedDate))}
        weekScores={weekScores}
        selectedDate={selectedDate}
        todayKey={todayKey}
        display="count"
        onSelect={setSelectedDate}
        onPrevWeek={
          dateKeys.length > 0 && mondayOfDate(selectedDate) > dateKeys[0]!
            ? () => {
                const target = addDaysToKey(selectedDate, -7);
                setSelectedDate(target < dateKeys[0]! ? dateKeys[0]! : target);
              }
            : undefined
        }
        onNextWeek={
          dateKeys.length > 0 &&
          addDaysToKey(mondayOfDate(selectedDate), 6) <
            dateKeys[dateKeys.length - 1]!
            ? () => {
                const target = addDaysToKey(selectedDate, 7);
                const last = dateKeys[dateKeys.length - 1]!;
                setSelectedDate(target > last ? last : target);
              }
            : undefined
        }
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
        <DaylightTile
          item={bestSpot}
          selectedDate={selectedDate}
          onPress={() => setActiveTile("daylight")}
        />
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
): Map<string, WeekScoreEntry> {
  const out = new Map<string, WeekScoreEntry>();
  for (const dateKey of dateKeys) {
    let goCount = 0;
    let total = 0;
    let windSum = 0;
    let windN = 0;
    for (const week of spotWeeks) {
      const day = week.days.find((d) => d.dateKey === dateKey);
      if (!day) continue;
      total += 1;
      if (day.verdict?.decision === "go") goCount += 1;
      for (const h of daylightHours(day.hours)) {
        windSum += h.windSpeedMs;
        windN++;
      }
    }
    const score = total > 0 ? Math.round((goCount / total) * 100) : 0;
    const avgWindKn = windN > 0 ? Math.round(msToKnots(windSum / windN)) : null;
    out.set(dateKey, { score, goCount, total, avgWindKn });
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

function averageWindAndGust(
  items: SpotWithVerdict[],
): { windKn: number; gustKn: number } | null {
  let windSum = 0;
  let gustSum = 0;
  let n = 0;
  for (const item of items) {
    for (const h of daylightHours(item.hours)) {
      windSum += h.windSpeedMs;
      gustSum += h.gustMs;
      n++;
    }
  }
  if (n === 0) return null;
  return {
    windKn: Math.round(msToKnots(windSum / n)),
    gustKn: Math.round(msToKnots(gustSum / n)),
  };
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
  scoreCol: { flexDirection: "column", alignItems: "flex-start" },
  windRow: { flexDirection: "row", alignItems: "baseline" },
  scoreNum: {
    fontSize: 48,
    fontWeight: "700",
    color: "#18181b",
    fontVariant: ["tabular-nums"],
    lineHeight: 50,
  },
  scoreAccent: { color: "#059669" },
  scoreOutOf: { fontSize: 13, color: "#71717a", marginLeft: 4 },
  windSep: {
    fontSize: 28,
    fontWeight: "600",
    color: "#a1a1aa",
    marginHorizontal: 4,
    fontVariant: ["tabular-nums"],
  },
  gustNum: {
    fontSize: 32,
    fontWeight: "700",
    color: "#3f3f46",
    fontVariant: ["tabular-nums"],
  },
  windCaption: {
    marginTop: 4,
    fontSize: 9,
    fontWeight: "600",
    letterSpacing: 0.5,
    color: "#71717a",
    textTransform: "uppercase",
  },
  scoreSummary: { flex: 1, paddingBottom: 4 },
  scoreLabel: { fontSize: 16, fontWeight: "600", color: "#18181b" },
  scoreSub: { fontSize: 13, color: "#71717a", marginTop: 2 },
  goPill: {
    alignSelf: "flex-start",
    marginTop: 6,
    backgroundColor: "#ecfdf5",
    borderColor: "#6ee7b7",
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  goPillText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#065f46",
  },
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
  prefsRow: {
    marginTop: 8,
    paddingTop: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderTopColor: "#f4f4f5",
    borderTopWidth: 1,
  },
  prefsText: { flex: 1, fontSize: 11, color: "#71717a" },
  prefsTextValue: { color: "#3f3f46", fontVariant: ["tabular-nums"] },
  prefsLink: { fontSize: 11, color: "#059669", fontWeight: "600" },
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
