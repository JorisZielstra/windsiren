import { Link } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import {
  fetchTodayVerdict,
  pickHomeSpot,
  type SpotWithVerdict,
} from "@windsiren/core";
import { cardinalDirection, msToKnots } from "@windsiren/shared";
import { useAuth } from "../lib/auth-context";
import { supabase } from "../lib/supabase";

export function WeatherStrip() {
  const { user, loading } = useAuth();
  const [data, setData] = useState<SpotWithVerdict | null>(null);

  useEffect(() => {
    if (loading) return;
    let cancelled = false;
    (async () => {
      const spot = await pickHomeSpot(supabase, user?.id ?? null);
      if (cancelled || !spot) {
        setData(null);
        return;
      }
      const result = await fetchTodayVerdict(spot);
      if (!cancelled) setData(result);
    })();
    return () => {
      cancelled = true;
    };
  }, [loading, user]);

  if (!data) return null;

  const peak = pickPeak(data.hours);
  const decision = data.verdict?.decision;
  const dotColor = verdictColor(decision);
  const label = decisionLabel(decision);

  return (
    <Link href={`/spots/${data.spot.slug}`} asChild>
      <Pressable style={styles.wrap}>
        <View style={[styles.dot, { backgroundColor: dotColor }]} />
        <Text style={styles.spotName} numberOfLines={1}>
          {data.spot.name}
        </Text>
        {peak ? (
          <>
            <Text style={styles.sep}>·</Text>
            <Text style={styles.wind}>
              {Math.round(msToKnots(peak.windSpeedMs))} kn{" "}
              <Text style={styles.windDir}>{cardinalDirection(peak.windDirectionDeg)}</Text>
            </Text>
          </>
        ) : null}
        <Text style={styles.sep}>·</Text>
        <Text style={styles.label}>{label}</Text>
        <View style={{ flex: 1 }} />
        <Text style={styles.arrow}>→</Text>
      </Pressable>
    </Link>
  );
}

function pickPeak(hours: SpotWithVerdict["hours"]) {
  if (!hours || hours.length === 0) return null;
  let best = hours[0]!;
  for (const h of hours) if (h.windSpeedMs > best.windSpeedMs) best = h;
  return best;
}

function verdictColor(d: "go" | "marginal" | "no_go" | undefined): string {
  if (d === "go") return "#10b981";
  if (d === "marginal") return "#f59e0b";
  if (d === "no_go") return "#a1a1aa";
  return "#d4d4d8";
}

function decisionLabel(d: "go" | "marginal" | "no_go" | undefined): string {
  if (d === "go") return "GO";
  if (d === "marginal") return "MAYBE";
  if (d === "no_go") return "NO GO";
  return "—";
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#e5e5e5",
    backgroundColor: "#fff",
    gap: 8,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  spotName: { fontSize: 14, fontWeight: "600", color: "#18181b" },
  sep: { fontSize: 14, color: "#a1a1aa" },
  wind: { fontSize: 13, color: "#3f3f46", fontVariant: ["tabular-nums"] },
  windDir: { color: "#71717a" },
  label: { fontSize: 11, fontWeight: "700", color: "#71717a", letterSpacing: 0.6 },
  arrow: { fontSize: 14, color: "#a1a1aa" },
});
