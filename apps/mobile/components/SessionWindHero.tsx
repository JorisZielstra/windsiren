import { StyleSheet, Text, View } from "react-native";
import { cardinalDirection, msToKnots } from "@windsiren/shared";
import type { SessionRow } from "@windsiren/supabase";
import { DirectionNeedle } from "./DirectionNeedle";

type Size = "card" | "detail";

type Props = {
  session: Pick<
    SessionRow,
    "wind_avg_ms" | "wind_max_ms" | "wind_dir_avg_deg" | "gust_max_ms" | "duration_minutes"
  >;
  size?: Size;
};

export function SessionWindHero({ session, size = "card" }: Props) {
  const dur = session.duration_minutes;
  const isDetail = size === "detail";

  if (session.wind_avg_ms == null) {
    return (
      <View style={[styles.fallback, isDetail && styles.fallbackDetail]}>
        <Text style={[styles.fallbackNumber, isDetail && styles.numberDetail]}>{dur}</Text>
        <Text style={styles.fallbackUnit}>min</Text>
        <Text style={styles.fallbackEmpty}>no wind data</Text>
      </View>
    );
  }

  const avgKn = Math.round(msToKnots(session.wind_avg_ms));
  const gustKn =
    session.gust_max_ms != null ? Math.round(msToKnots(session.gust_max_ms)) : null;
  const dirDeg = session.wind_dir_avg_deg;
  const dirLabel = dirDeg != null ? cardinalDirection(dirDeg) : null;
  const needleSize = isDetail ? 60 : 40;

  return (
    <View style={[styles.hero, isDetail && styles.heroDetail]}>
      <Stat value={avgKn} unit="kn" label="AVG" accent isDetail={isDetail} />
      {gustKn !== null ? (
        <Stat value={gustKn} unit="kn" label="GUST" isDetail={isDetail} />
      ) : null}
      {dirDeg != null && dirLabel ? (
        <View style={styles.dirCol}>
          <DirectionNeedle directionDeg={dirDeg} size={needleSize} />
          <View>
            <Text
              style={[styles.dirLabel, isDetail && styles.dirLabelDetail]}
            >
              {dirLabel}
            </Text>
            <Text style={styles.dirDeg}>{Math.round(dirDeg)}°</Text>
          </View>
        </View>
      ) : null}
      <View style={styles.spacer} />
      <Stat value={dur} unit="min" label="DURATION" isDetail={isDetail} />
    </View>
  );
}

function Stat({
  value,
  unit,
  label,
  accent = false,
  isDetail,
}: {
  value: number;
  unit: string;
  label: string;
  accent?: boolean;
  isDetail: boolean;
}) {
  return (
    <View>
      <View style={styles.numberRow}>
        <Text
          style={[
            styles.number,
            isDetail && styles.numberDetail,
            accent && styles.accent,
          ]}
        >
          {value}
        </Text>
        <Text style={styles.unit}>{unit}</Text>
      </View>
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}


const styles = StyleSheet.create({
  hero: {
    flexDirection: "row",
    alignItems: "flex-end",
    flexWrap: "wrap",
    gap: 16,
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 12,
  },
  heroDetail: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 20, gap: 22 },
  spacer: { flex: 1 },
  numberRow: { flexDirection: "row", alignItems: "baseline" },
  number: {
    fontSize: 28,
    fontWeight: "700",
    color: "#18181b",
    fontVariant: ["tabular-nums"],
    lineHeight: 30,
  },
  numberDetail: { fontSize: 44, lineHeight: 46 },
  accent: { color: "#059669" },
  unit: { fontSize: 12, color: "#71717a", marginLeft: 3 },
  label: {
    fontSize: 9,
    fontWeight: "600",
    letterSpacing: 0.6,
    color: "#71717a",
    marginTop: 3,
  },
  dirCol: { flexDirection: "row", alignItems: "center", gap: 6 },
  dirLabel: {
    fontSize: 16,
    fontWeight: "700",
    color: "#18181b",
    fontVariant: ["tabular-nums"],
  },
  dirLabelDetail: { fontSize: 22 },
  dirDeg: { fontSize: 9, fontWeight: "600", letterSpacing: 0.6, color: "#71717a" },
  fallback: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 6,
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 12,
  },
  fallbackDetail: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 20 },
  fallbackNumber: {
    fontSize: 28,
    fontWeight: "700",
    color: "#18181b",
    fontVariant: ["tabular-nums"],
  },
  fallbackUnit: { fontSize: 13, color: "#71717a" },
  fallbackEmpty: { fontSize: 11, color: "#a1a1aa", marginLeft: "auto" },
});
