import { Link } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { peakWindMs, type SpotWithVerdict } from "@windsiren/core";
import {
  cardinalDirection,
  DEFAULT_THRESHOLDS,
  isHourRideable,
  msToKnots,
} from "@windsiren/shared";

export function HeroSpotCard({ item }: { item: SpotWithVerdict }) {
  const peak = peakWindMs(item.hours);
  const rideableCount = item.hours.filter((h) =>
    isHourRideable(h, item.spot, DEFAULT_THRESHOLDS),
  ).length;

  const decision = item.verdict?.decision;

  return (
    <Link href={`/spots/${item.spot.slug}`} asChild>
      <Pressable style={styles.card}>
        <Text style={styles.eyebrow}>TODAY</Text>
        <Text style={styles.name}>{item.spot.name}</Text>

        <View style={styles.row}>
          <View style={[styles.pill, pillBg(decision)]}>
            <Text style={[styles.pillText, pillText(decision)]}>{label(decision)}</Text>
          </View>
          {peak !== null ? (
            <View style={styles.peakWrap}>
              <Text style={styles.peakValue}>{Math.round(msToKnots(peak))}</Text>
              <Text style={styles.peakUnit}>kn peak</Text>
              <Text style={styles.peakDir}>{peakDirection(item.hours)}</Text>
            </View>
          ) : null}
        </View>

        <Text style={styles.rideable}>
          {rideableCount > 0 ? (
            <>
              <Text style={styles.rideableCount}>{rideableCount}</Text>
              <Text>
                {" "}
                rideable {rideableCount === 1 ? "hour" : "hours"} today
              </Text>
            </>
          ) : (
            <Text>No rideable hours today</Text>
          )}
        </Text>

        <View style={styles.footer}>
          <Text style={styles.coords}>
            {item.spot.lat.toFixed(3)}°N, {item.spot.lng.toFixed(3)}°E
          </Text>
          <Text style={styles.cta}>Open spot →</Text>
        </View>
      </Pressable>
    </Link>
  );
}

function peakDirection(hours: SpotWithVerdict["hours"]): string {
  if (hours.length === 0) return "";
  let best = hours[0]!;
  for (const h of hours) if (h.windSpeedMs > best.windSpeedMs) best = h;
  return cardinalDirection(best.windDirectionDeg);
}

function label(d: "go" | "marginal" | "no_go" | undefined): string {
  if (d === "go") return "GO";
  if (d === "marginal") return "MAYBE";
  if (d === "no_go") return "NO GO";
  return "—";
}

function pillBg(d: "go" | "marginal" | "no_go" | undefined) {
  if (d === "go") return { backgroundColor: "#dcfce7" };
  if (d === "marginal") return { backgroundColor: "#fef3c7" };
  return { backgroundColor: "#f4f4f5" };
}

function pillText(d: "go" | "marginal" | "no_go" | undefined) {
  if (d === "go") return { color: "#065f46" };
  if (d === "marginal") return { color: "#92400e" };
  return { color: "#52525b" };
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 14,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e5e5e5",
    padding: 20,
    marginHorizontal: 16,
    marginBottom: 24,
  },
  eyebrow: {
    fontSize: 10,
    fontWeight: "700",
    color: "#71717a",
    letterSpacing: 1.5,
  },
  name: { fontSize: 26, fontWeight: "700", color: "#18181b", marginTop: 8 },
  row: { flexDirection: "row", alignItems: "center", marginTop: 20, gap: 16 },
  pill: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 999 },
  pillText: { fontSize: 12, fontWeight: "700", letterSpacing: 0.8 },
  peakWrap: { flexDirection: "row", alignItems: "baseline", gap: 6, flexWrap: "wrap" },
  peakValue: {
    fontSize: 28,
    fontWeight: "700",
    color: "#18181b",
    fontVariant: ["tabular-nums"],
  },
  peakUnit: { fontSize: 12, color: "#71717a" },
  peakDir: { fontSize: 14, color: "#3f3f46" },
  rideable: { fontSize: 13, color: "#52525b", marginTop: 12 },
  rideableCount: { fontWeight: "700", color: "#047857" },
  footer: {
    marginTop: 18,
    paddingTop: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#e5e5e5",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  coords: { fontSize: 11, color: "#71717a" },
  cta: { fontSize: 13, fontWeight: "600", color: "#047857" },
});
