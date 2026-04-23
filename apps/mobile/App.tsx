import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import type { SpotRow } from "@windsiren/supabase";
import { supabase } from "./lib/supabase";

type SpotSummary = Pick<
  SpotRow,
  "id" | "slug" | "name" | "lat" | "lng" | "tide_sensitive"
>;

export default function App() {
  const [spots, setSpots] = useState<SpotSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    supabase
      .from("spots")
      .select("id, slug, name, lat, lng, tide_sensitive")
      .eq("active", true)
      .order("name")
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          setError(error.message);
          return;
        }
        setSpots(data ?? []);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>WindSiren</Text>
        <Text style={styles.subtitle}>
          {error
            ? "Failed to load spots"
            : spots
              ? `${spots.length} curated NL kitesurf spots`
              : "Loading…"}
        </Text>
      </View>

      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorTitle}>Supabase query failed</Text>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : !spots ? (
        <ActivityIndicator style={styles.loader} size="large" />
      ) : (
        <FlatList
          data={spots}
          keyExtractor={(s) => s.id}
          renderItem={({ item }) => (
            <View style={styles.row}>
              <View style={styles.rowMain}>
                <Text style={styles.rowTitle}>{item.name}</Text>
                <Text style={styles.rowSub}>
                  {item.lat.toFixed(3)}°N, {item.lng.toFixed(3)}°E
                </Text>
              </View>
              {item.tide_sensitive ? (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>Tide</Text>
                </View>
              ) : null}
            </View>
          )}
        />
      )}

      <StatusBar style="auto" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  header: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#e5e5e5",
  },
  title: { fontSize: 28, fontWeight: "700" },
  subtitle: { fontSize: 14, color: "#6b7280", marginTop: 4 },
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
  rowTitle: { fontSize: 16, fontWeight: "500" },
  rowSub: { fontSize: 12, color: "#6b7280", marginTop: 2 },
  badge: {
    backgroundColor: "#dbeafe",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  badgeText: { fontSize: 10, color: "#1e40af", fontWeight: "600" },
});
