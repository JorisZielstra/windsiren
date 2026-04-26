import { Link } from "expo-router";
import { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import {
  averageDirectionDeg,
  classifyWindTrend,
  getSunTimes,
  type PublicProfile,
  type SpotWeek,
  type SpotWithVerdict,
  type WindTrend,
} from "@windsiren/core";
import {
  cardinalDirection,
  DEFAULT_THRESHOLDS,
  isHourRideable,
  msToKnots,
  type HourlyForecast,
} from "@windsiren/shared";
import { DirectionNeedle } from "./DirectionNeedle";

type Props = {
  spotWeeks: SpotWeek[];
  todayKey: string;
  friendsCount: number;
  friendsPreview: PublicProfile[];
  signedIn: boolean;
};

export function TodayDashboard({
  spotWeeks,
  todayKey,
  friendsCount,
  friendsPreview,
  signedIn,
}: Props) {
  const dateKeys = useMemo(() => collectDateKeys(spotWeeks), [spotWeeks]);
  const [selectedDate, setSelectedDate] = useState<string>(
    dateKeys.includes(todayKey) ? todayKey : (dateKeys[0] ?? todayKey),
  );

  const dayItems: SpotWithVerdict[] = useMemo(
    () =>
      spotWeeks.map((week) => {
        const day = week.days.find((d) => d.dateKey === selectedDate);
        return {
          spot: week.spot,
          verdict: day?.verdict ?? null,
          hours: day?.hours ?? [],
        };
      }),
    [spotWeeks, selectedDate],
  );

  const total = dayItems.length;
  const goCount = dayItems.filter((v) => v.verdict?.decision === "go").length;
  const dayScore = total > 0 ? Math.round((goCount / total) * 100) : 0;
  const dayLabel = labelForScore(dayScore);
  const scoreAccent = dayScore >= 40;

  const bestSpot = pickBestSpot(dayItems);
  const isToday = selectedDate === todayKey;
  const dateLabel = formatDateLabel(selectedDate, isToday);
  const weekScores = useMemo(() => buildWeekScores(spotWeeks, dateKeys), [spotWeeks, dateKeys]);

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
                  {" "}of {total} spots GO
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
        <WindTile bestSpot={bestSpot} />
        <AirTempTile bestSpot={bestSpot} />
        {signedIn ? (
          <FriendsTile count={friendsCount} preview={friendsPreview} isToday={isToday} />
        ) : (
          <SignInTile />
        )}
        <PeakWindowTile dayItems={dayItems} bestSpot={bestSpot} />
        <DaylightTile bestSpot={bestSpot} selectedDate={selectedDate} />
        <TrendTile bestSpot={bestSpot} />
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Week strip
// ---------------------------------------------------------------------------

function WeekStrip({
  dateKeys,
  weekScores,
  selectedDate,
  todayKey,
  onSelect,
}: {
  dateKeys: string[];
  weekScores: Map<string, { score: number; goCount: number; total: number }>;
  selectedDate: string;
  todayKey: string;
  onSelect: (dateKey: string) => void;
}) {
  if (dateKeys.length === 0) return null;
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.weekStrip}
    >
      {dateKeys.map((dateKey) => {
        const stats = weekScores.get(dateKey);
        const score = stats?.score ?? 0;
        const isSelected = dateKey === selectedDate;
        const isToday = dateKey === todayKey;
        const accentBg = scoreAccentColor(score);
        return (
          <Pressable
            key={dateKey}
            onPress={() => onSelect(dateKey)}
            style={[styles.weekChip, isSelected && styles.weekChipSelected]}
          >
            <Text
              style={[
                styles.weekChipDay,
                isSelected
                  ? styles.weekChipDaySelected
                  : isToday
                    ? styles.weekChipDayToday
                    : null,
              ]}
            >
              {isToday ? "TODAY" : weekdayShort(dateKey)}
            </Text>
            <Text
              style={[styles.weekChipScore, isSelected && styles.weekChipScoreSelected]}
            >
              {score}
            </Text>
            <View
              style={[
                styles.weekChipBar,
                isSelected ? styles.weekChipBarSelected : { backgroundColor: accentBg },
              ]}
            />
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

function scoreAccentColor(score: number): string {
  if (score >= 70) return "#10b981";
  if (score >= 40) return "#6ee7b7";
  if (score >= 20) return "#fcd34d";
  return "#d4d4d8";
}

// ---------------------------------------------------------------------------
// Tiles
// ---------------------------------------------------------------------------

function WindTile({ bestSpot }: { bestSpot: SpotWithVerdict | null }) {
  if (!bestSpot) return <Tile label="WIND">—</Tile>;
  const dirs = daylightHours(bestSpot.hours).map((h) => h.windDirectionDeg);
  if (dirs.length === 0) return <Tile label="WIND">—</Tile>;
  const avgDeg = averageDirectionDeg(dirs);
  return (
    <Tile label="WIND AVG">
      <View style={styles.windRow}>
        <DirectionNeedle directionDeg={avgDeg} size={32} />
        <View>
          <Text style={styles.tileValue}>{cardinalDirection(avgDeg)}</Text>
          <Text style={styles.tileSubSmall}>{Math.round(avgDeg)}°</Text>
        </View>
      </View>
    </Tile>
  );
}

function AirTempTile({ bestSpot }: { bestSpot: SpotWithVerdict | null }) {
  if (!bestSpot) return <Tile label="AIR TEMP">—</Tile>;
  const temps = daylightHours(bestSpot.hours)
    .map((h) => h.airTempC)
    .filter((t): t is number => t != null);
  if (temps.length === 0) return <Tile label="AIR TEMP">—</Tile>;
  const avg = temps.reduce((s, x) => s + x, 0) / temps.length;
  return (
    <Tile label="AIR TEMP" sub={`at ${bestSpot.spot.name}`}>
      <Text style={styles.tileValue}>{Math.round(avg)}°C</Text>
    </Tile>
  );
}

function FriendsTile({
  count,
  preview,
  isToday,
}: {
  count: number;
  preview: PublicProfile[];
  isToday: boolean;
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
    <Tile label="FRIENDS" sub="out today">
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

function PeakWindowTile({
  dayItems,
  bestSpot,
}: {
  dayItems: SpotWithVerdict[];
  bestSpot: SpotWithVerdict | null;
}) {
  if (!bestSpot) return <Tile label="PEAK WINDOW">—</Tile>;
  const window = longestRideableRun(bestSpot);
  let peakGustMs = 0;
  let peakGustSpotName: string | null = null;
  for (const v of dayItems) {
    for (const h of v.hours) {
      if (h.gustMs > peakGustMs) {
        peakGustMs = h.gustMs;
        peakGustSpotName = v.spot.name;
      }
    }
  }
  const sub = peakGustSpotName
    ? `gust ${Math.round(msToKnots(peakGustMs))} kn at ${peakGustSpotName}`
    : undefined;
  if (!window) {
    return (
      <Tile label="PEAK WINDOW" sub={sub}>
        —
      </Tile>
    );
  }
  return (
    <Tile label="PEAK WINDOW" sub={sub}>
      <Text style={styles.tileValue}>
        {pad2(window.startHour)}–{pad2(window.endHour)}h
      </Text>
    </Tile>
  );
}

function DaylightTile({
  bestSpot,
  selectedDate,
}: {
  bestSpot: SpotWithVerdict | null;
  selectedDate: string;
}) {
  if (!bestSpot) return <Tile label="DAYLIGHT">—</Tile>;
  const { sunrise, sunset } = getSunTimes(
    bestSpot.spot.lat,
    bestSpot.spot.lng,
    new Date(`${selectedDate}T12:00:00Z`),
  );
  const lengthMs = sunset.getTime() - sunrise.getTime();
  const hours = Math.floor(lengthMs / 3600000);
  const minutes = Math.floor((lengthMs % 3600000) / 60000);
  return (
    <Tile label="DAYLIGHT" sub={`${hours}h ${minutes}m`}>
      <Text style={styles.tileValueSmall}>
        {fmtNlClock(sunrise)} → {fmtNlClock(sunset)}
      </Text>
    </Tile>
  );
}

function TrendTile({ bestSpot }: { bestSpot: SpotWithVerdict | null }) {
  if (!bestSpot) return <Tile label="TREND">—</Tile>;
  const trend = classifyWindTrend(bestSpot.hours);
  const arrow = trend === "rising" ? "↑" : trend === "dropping" ? "↓" : "→";
  const accentStyle =
    trend === "rising"
      ? styles.trendRising
      : trend === "dropping"
        ? styles.trendDropping
        : styles.trendHolding;
  return (
    <Tile label="TREND" sub={`at ${bestSpot.spot.name}`}>
      <Text style={[styles.tileValue, accentStyle]}>
        {arrow} {labelForTrend(trend)}
      </Text>
    </Tile>
  );
}

// ---------------------------------------------------------------------------
// Building blocks + helpers
// ---------------------------------------------------------------------------

function Tile({
  label,
  sub,
  children,
}: {
  label: string;
  sub?: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.tile}>
      <Text style={styles.tileLabel}>{label}</Text>
      <View style={styles.tileBody}>
        {typeof children === "string" ? (
          <Text style={styles.tileValue}>{children}</Text>
        ) : (
          children
        )}
      </View>
      {sub ? (
        <Text style={styles.tileSub} numberOfLines={1}>
          {sub}
        </Text>
      ) : null}
    </View>
  );
}

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

function labelForTrend(t: WindTrend): string {
  if (t === "rising") return "rising";
  if (t === "dropping") return "dropping";
  return "holding";
}

function countRideable(item: SpotWithVerdict): number {
  return item.hours.filter((h) =>
    isHourRideable(h, item.spot, DEFAULT_THRESHOLDS),
  ).length;
}

function longestRideableRun(
  item: SpotWithVerdict,
): { startHour: number; endHour: number } | null {
  const daylight = daylightHours(item.hours);
  let bestStart: number | null = null;
  let bestLen = 0;
  let curStart: number | null = null;
  let curLen = 0;
  for (const h of daylight) {
    if (isHourRideable(h, item.spot, DEFAULT_THRESHOLDS)) {
      if (curStart === null) curStart = nlLocalHour(new Date(h.time));
      curLen += 1;
    } else {
      if (curLen > bestLen && curStart !== null) {
        bestStart = curStart;
        bestLen = curLen;
      }
      curStart = null;
      curLen = 0;
    }
  }
  if (curLen > bestLen && curStart !== null) {
    bestStart = curStart;
    bestLen = curLen;
  }
  if (bestStart === null || bestLen === 0) return null;
  return { startHour: bestStart, endHour: bestStart + bestLen };
}

function daylightHours(hours: HourlyForecast[]): HourlyForecast[] {
  return hours.filter((h) => {
    const localHour = nlLocalHour(new Date(h.time));
    return localHour >= 8 && localHour <= 20;
  });
}

function nlLocalHour(d: Date): number {
  const hh = new Intl.DateTimeFormat("en-NL", {
    timeZone: "Europe/Amsterdam",
    hour: "2-digit",
    hour12: false,
  }).format(d);
  return parseInt(hh, 10);
}

function fmtNlClock(d: Date): string {
  return new Intl.DateTimeFormat("en-NL", {
    timeZone: "Europe/Amsterdam",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(d);
}

function pad2(n: number): string {
  return n.toString().padStart(2, "0");
}

function weekdayShort(dateKey: string): string {
  const d = new Date(`${dateKey}T12:00:00Z`);
  return d
    .toLocaleDateString("en-NL", { weekday: "short", timeZone: "Europe/Amsterdam" })
    .toUpperCase();
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
  weekStrip: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 8,
    borderTopColor: "#f4f4f5",
    borderTopWidth: 1,
  },
  weekChip: {
    width: 56,
    paddingVertical: 8,
    alignItems: "center",
    borderRadius: 8,
  },
  weekChipSelected: { backgroundColor: "#18181b" },
  weekChipDay: {
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 0.6,
    color: "#71717a",
  },
  weekChipDayToday: { color: "#059669" },
  weekChipDaySelected: { color: "#a1a1aa" },
  weekChipScore: {
    marginTop: 4,
    fontSize: 16,
    fontWeight: "700",
    color: "#18181b",
    fontVariant: ["tabular-nums"],
  },
  weekChipScoreSelected: { color: "#fff" },
  weekChipBar: {
    marginTop: 4,
    height: 3,
    width: 24,
    borderRadius: 999,
  },
  weekChipBarSelected: { backgroundColor: "rgba(255,255,255,0.4)" },
  tileGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    borderTopColor: "#f4f4f5",
    borderTopWidth: 1,
  },
  tile: {
    width: "50%",
    padding: 12,
    borderRightColor: "#f4f4f5",
    borderRightWidth: 1,
    borderBottomColor: "#f4f4f5",
    borderBottomWidth: 1,
    minHeight: 84,
  },
  tileLabel: {
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 0.6,
    color: "#71717a",
  },
  tileBody: { marginTop: 6 },
  tileValue: {
    fontSize: 20,
    fontWeight: "700",
    color: "#18181b",
    fontVariant: ["tabular-nums"],
  },
  tileValueSmall: {
    fontSize: 14,
    fontWeight: "700",
    color: "#18181b",
    fontVariant: ["tabular-nums"],
  },
  tileAccent: { color: "#059669" },
  tileMuted: { color: "#a1a1aa" },
  tileSub: { marginTop: 4, fontSize: 11, color: "#71717a" },
  tileSubSmall: { fontSize: 10, color: "#71717a", marginTop: 2 },
  windRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  signInLink: { fontSize: 14, color: "#059669", fontWeight: "600" },
  trendRising: { color: "#059669" },
  trendDropping: { color: "#d97706" },
  trendHolding: { color: "#3f3f46" },
});
