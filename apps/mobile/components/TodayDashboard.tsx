import { Link } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import {
  averageDirectionDeg,
  classifyWindTrend,
  getSunTimes,
  type PublicProfile,
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
  withVerdicts: SpotWithVerdict[];
  bestSpot: SpotWithVerdict | null;
  todayLabel: string;
  friendsCount: number;
  friendsPreview: PublicProfile[];
  signedIn: boolean;
};

export function TodayDashboard({
  withVerdicts,
  bestSpot,
  todayLabel,
  friendsCount,
  friendsPreview,
  signedIn,
}: Props) {
  const total = withVerdicts.length;
  const goCount = withVerdicts.filter((v) => v.verdict?.decision === "go").length;
  const dayScore = total > 0 ? Math.round((goCount / total) * 100) : 0;
  const dayLabel = labelForScore(dayScore);
  const scoreAccent = dayScore >= 40;

  return (
    <View style={styles.card}>
      <View style={styles.heroSection}>
        <View style={styles.heroTopRow}>
          <Text style={styles.todayBadge}>TODAY</Text>
          <Text style={styles.todayDate}>{todayLabel}</Text>
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

      <View style={styles.tileGrid}>
        <WindTile bestSpot={bestSpot} />
        <AirTempTile bestSpot={bestSpot} />
        {signedIn ? (
          <FriendsTile count={friendsCount} preview={friendsPreview} />
        ) : (
          <SignInTile />
        )}
        <PeakWindowTile withVerdicts={withVerdicts} bestSpot={bestSpot} />
        <DaylightTile bestSpot={bestSpot} />
        <TrendTile bestSpot={bestSpot} />
      </View>
    </View>
  );
}

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
}: {
  count: number;
  preview: PublicProfile[];
}) {
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
  withVerdicts,
  bestSpot,
}: {
  withVerdicts: SpotWithVerdict[];
  bestSpot: SpotWithVerdict | null;
}) {
  if (!bestSpot) return <Tile label="PEAK WINDOW">—</Tile>;
  const window = longestRideableRun(bestSpot);
  let peakGustMs = 0;
  let peakGustSpotName: string | null = null;
  for (const v of withVerdicts) {
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

function DaylightTile({ bestSpot }: { bestSpot: SpotWithVerdict | null }) {
  if (!bestSpot) return <Tile label="DAYLIGHT">—</Tile>;
  const { sunrise, sunset } = getSunTimes(
    bestSpot.spot.lat,
    bestSpot.spot.lng,
    new Date(),
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
  tileSub: { marginTop: 4, fontSize: 11, color: "#71717a" },
  tileSubSmall: { fontSize: 10, color: "#71717a", marginTop: 2 },
  windRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  signInLink: { fontSize: 14, color: "#059669", fontWeight: "600" },
  trendRising: { color: "#059669" },
  trendDropping: { color: "#d97706" },
  trendHolding: { color: "#3f3f46" },
});
