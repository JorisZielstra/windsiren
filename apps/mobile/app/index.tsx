import { Link, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { msToKnots, type Verdict } from "@windsiren/shared";
import {
  dbRowToSpot,
  fetchTodayVerdict,
  peakWindMs,
  type SpotWithVerdict,
} from "@windsiren/core";
import { supabase } from "../lib/supabase";

export default function SpotsListScreen() {
  const [items, setItems] = useState<SpotWithVerdict[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        setError(null);
        const { data: rows, error: dbErr } = await supabase
          .from("spots")
          .select("*")
          .eq("active", true)
          .order("name");
        if (cancelled) return;
        if (dbErr) {
          setError(dbErr.message);
          return;
        }
        const spots = (rows ?? []).map(dbRowToSpot);
        const results = await Promise.all(spots.map(fetchTodayVerdict));
        if (!cancelled) setItems(results);
      })();
      return () => {
        cancelled = true;
      };
    }, []),
  );

  return (
    <SafeAreaView style={styles.container} edges={["bottom"]}>
      <View style={styles.header}>
        <Text style={styles.subtitle}>
          {error
            ? "Failed to load spots"
            : items
              ? `${items.length} curated NL spots · today · intermediate preset`
              : "Loading…"}
        </Text>
      </View>

      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorTitle}>Something went wrong</Text>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : !items ? (
        <ActivityIndicator style={styles.loader} size="large" />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.spot.id}
          renderItem={({ item }) => <SpotRow item={item} />}
        />
      )}
    </SafeAreaView>
  );
}

function SpotRow({ item }: { item: SpotWithVerdict }) {
  const peak = peakWindMs(item.hours);
  return (
    <Link href={`/spots/${item.spot.slug}`} asChild>
      <View style={styles.row}>
        <View style={styles.rowMain}>
          <View style={styles.rowTitleLine}>
            <Text style={styles.rowTitle}>{item.spot.name}</Text>
            {item.spot.tideSensitive ? (
              <View style={styles.tideBadge}>
                <Text style={styles.tideBadgeText}>Tide</Text>
              </View>
            ) : null}
          </View>
          <Text style={styles.rowSub}>
            {item.spot.lat.toFixed(3)}°N, {item.spot.lng.toFixed(3)}°E
            {peak !== null ? `  ·  peak ${msToKnots(peak).toFixed(0)} kn` : ""}
          </Text>
        </View>
        <VerdictPill verdict={item.verdict} />
      </View>
    </Link>
  );
}

function VerdictPill({ verdict }: { verdict: Verdict | null }) {
  if (!verdict) {
    return (
      <View style={[styles.verdictPill, { backgroundColor: "#f4f4f5" }]}>
        <Text style={[styles.verdictText, { color: "#71717a" }]}>No data</Text>
      </View>
    );
  }
  const palette = {
    go: { bg: "#dcfce7", fg: "#065f46" },
    marginal: { bg: "#fef3c7", fg: "#92400e" },
    no_go: { bg: "#f4f4f5", fg: "#52525b" },
  } as const;
  const labels = { go: "GO", marginal: "MAYBE", no_go: "NO GO" } as const;
  const p = palette[verdict.decision];
  return (
    <View style={[styles.verdictPill, { backgroundColor: p.bg }]}>
      <Text style={[styles.verdictText, { color: p.fg }]}>{labels[verdict.decision]}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  header: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#e5e5e5",
  },
  subtitle: { fontSize: 13, color: "#6b7280" },
  loader: { marginTop: 48 },
  errorBox: {
    margin: 16,
    padding: 16,
    borderRadius: 8,
    backgroundColor: "#fef2f2",
    borderWidth: 1,
    borderColor: "#fecaca",
  },
  errorTitle: { fontWeight: "600", color: "#991b1b" },
  errorText: { marginTop: 4, color: "#7f1d1d", fontSize: 13 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#f0f0f0",
  },
  rowMain: { flex: 1 },
  rowTitleLine: { flexDirection: "row", alignItems: "center", gap: 8 },
  rowTitle: { fontSize: 16, fontWeight: "500" },
  rowSub: { fontSize: 12, color: "#6b7280", marginTop: 2 },
  tideBadge: {
    backgroundColor: "#dbeafe",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  tideBadgeText: { fontSize: 10, color: "#1e40af", fontWeight: "600" },
  verdictPill: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 999 },
  verdictText: { fontSize: 11, fontWeight: "700", letterSpacing: 0.5 },
});
