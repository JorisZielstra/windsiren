import { Link } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import {
  fetchTodayVerdict,
  getPublicProfile,
  pickHomeSpot,
  type PublicProfile,
  type SpotWithVerdict,
} from "@windsiren/core";
import { cardinalDirection, msToKnots } from "@windsiren/shared";
import { useAuth } from "../lib/auth-context";
import { supabase } from "../lib/supabase";
import { Avatar } from "./Avatar";

export function WeatherStrip() {
  const { user, loading } = useAuth();
  const [data, setData] = useState<SpotWithVerdict | null>(null);
  const [profile, setProfile] = useState<PublicProfile | null>(null);

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

  useEffect(() => {
    if (loading || !user) {
      setProfile(null);
      return;
    }
    let cancelled = false;
    (async () => {
      const p = await getPublicProfile(supabase, user.id);
      if (!cancelled) setProfile(p);
    })();
    return () => {
      cancelled = true;
    };
  }, [loading, user]);

  if (!data && !user) return null;

  const peak = data ? pickPeak(data.hours) : null;
  const decision = data?.verdict?.decision;
  const dotColor = verdictColor(decision);
  const label = decisionLabel(decision);

  return (
    <View style={styles.wrap}>
      {data ? (
        <Link href={`/spots/${data.spot.slug}`} asChild>
          <Pressable style={styles.row}>
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
          </Pressable>
        </Link>
      ) : (
        <View style={styles.row} />
      )}
      {user ? (
        <Link href="/(tabs)/profile" asChild>
          <Pressable accessibilityLabel="Open profile" style={styles.avatarWrap}>
            <Avatar
              url={profile?.avatar_url ?? null}
              name={profile?.display_name ?? null}
              size={28}
            />
          </Pressable>
        </Link>
      ) : null}
    </View>
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
  row: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  spotName: { fontSize: 14, fontWeight: "600", color: "#18181b" },
  sep: { fontSize: 14, color: "#a1a1aa" },
  wind: { fontSize: 13, color: "#3f3f46", fontVariant: ["tabular-nums"] },
  windDir: { color: "#71717a" },
  label: { fontSize: 11, fontWeight: "700", color: "#71717a", letterSpacing: 0.6 },
  avatarWrap: {
    borderWidth: 1,
    borderColor: "#e4e4e7",
    borderRadius: 999,
  },
});
