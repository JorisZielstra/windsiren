import { Pressable, StyleSheet, Text, View } from "react-native";
import {
  averageDirectionDeg,
  classifyWindTrend,
  getSunTimes,
  type SpotWithVerdict,
  type WindTrend,
} from "@windsiren/core";
import { cardinalDirection, msToKnots } from "@windsiren/shared";
import {
  daylightHours,
  fmtNlClock,
  longestRideableRun,
  pad2,
} from "./dashboard-utils";
import { DirectionNeedle } from "./DirectionNeedle";

export function Tile({
  label,
  sub,
  children,
  onPress,
}: {
  label: string;
  sub?: string;
  children: React.ReactNode;
  onPress?: () => void;
}) {
  const inner = (
    <>
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
    </>
  );
  if (onPress) {
    return (
      <Pressable
        style={({ pressed }) => [styles.tile, pressed && styles.tilePressed]}
        onPress={onPress}
      >
        {inner}
      </Pressable>
    );
  }
  return <View style={styles.tile}>{inner}</View>;
}

export function WindTile({
  item,
  onPress,
}: {
  item: SpotWithVerdict | null;
  onPress?: () => void;
}) {
  if (!item) return <Tile label="WIND">—</Tile>;
  const dirs = daylightHours(item.hours).map((h) => h.windDirectionDeg);
  if (dirs.length === 0) return <Tile label="WIND">—</Tile>;
  const avgDeg = averageDirectionDeg(dirs);
  return (
    <Tile label="WIND AVG" onPress={onPress}>
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

export function AirTempTile({
  item,
  showSpotName = true,
  onPress,
}: {
  item: SpotWithVerdict | null;
  showSpotName?: boolean;
  onPress?: () => void;
}) {
  if (!item) return <Tile label="AIR TEMP">—</Tile>;
  const temps = daylightHours(item.hours)
    .map((h) => h.airTempC)
    .filter((t): t is number => t != null);
  if (temps.length === 0) return <Tile label="AIR TEMP">—</Tile>;
  const avg = temps.reduce((s, x) => s + x, 0) / temps.length;
  const sub = showSpotName ? `at ${item.spot.name}` : undefined;
  return (
    <Tile label="AIR TEMP" sub={sub} onPress={onPress}>
      <Text style={styles.tileValue}>{Math.round(avg)}°C</Text>
    </Tile>
  );
}

export function PeakWindowTile({
  dayItems,
  item,
  showSpotName = true,
  onPress,
}: {
  dayItems: SpotWithVerdict[];
  item: SpotWithVerdict | null;
  showSpotName?: boolean;
  onPress?: () => void;
}) {
  if (!item) return <Tile label="PEAK WINDOW">—</Tile>;
  const window = longestRideableRun(item);
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
    ? showSpotName
      ? `gust ${Math.round(msToKnots(peakGustMs))} kn at ${peakGustSpotName}`
      : `gust ${Math.round(msToKnots(peakGustMs))} kn`
    : undefined;
  if (!window) {
    return (
      <Tile label="PEAK WINDOW" sub={sub} onPress={onPress}>
        —
      </Tile>
    );
  }
  return (
    <Tile label="PEAK WINDOW" sub={sub} onPress={onPress}>
      <Text style={styles.tileValue}>
        {pad2(window.startHour)}–{pad2(window.endHour)}h
      </Text>
    </Tile>
  );
}

export function DaylightTile({
  item,
  selectedDate,
}: {
  item: SpotWithVerdict | null;
  selectedDate: string;
}) {
  if (!item) return <Tile label="DAYLIGHT">—</Tile>;
  const { sunrise, sunset } = getSunTimes(
    item.spot.lat,
    item.spot.lng,
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

export function TrendTile({
  item,
  showSpotName = true,
  onPress,
}: {
  item: SpotWithVerdict | null;
  showSpotName?: boolean;
  onPress?: () => void;
}) {
  if (!item) return <Tile label="TREND">—</Tile>;
  const trend = classifyWindTrend(item.hours);
  const arrow = trend === "rising" ? "↑" : trend === "dropping" ? "↓" : "→";
  const accentStyle =
    trend === "rising"
      ? styles.trendRising
      : trend === "dropping"
        ? styles.trendDropping
        : styles.trendHolding;
  const sub = showSpotName ? `at ${item.spot.name}` : undefined;
  return (
    <Tile label="TREND" sub={sub} onPress={onPress}>
      <Text style={[styles.tileValue, accentStyle]}>
        {arrow} {labelForTrend(trend)}
      </Text>
    </Tile>
  );
}

function labelForTrend(t: WindTrend): string {
  if (t === "rising") return "rising";
  if (t === "dropping") return "dropping";
  return "holding";
}

const styles = StyleSheet.create({
  tile: {
    width: "50%",
    padding: 12,
    borderRightColor: "#f4f4f5",
    borderRightWidth: 1,
    borderBottomColor: "#f4f4f5",
    borderBottomWidth: 1,
    minHeight: 84,
  },
  tilePressed: { backgroundColor: "#fafafa" },
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
  tileSub: { marginTop: 4, fontSize: 11, color: "#71717a" },
  tileSubSmall: { fontSize: 10, color: "#71717a", marginTop: 2 },
  windRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  trendRising: { color: "#059669" },
  trendDropping: { color: "#d97706" },
  trendHolding: { color: "#3f3f46" },
});
