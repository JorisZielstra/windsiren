import { Stack, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  cardinalDirection,
  evaluateDay,
  INTERMEDIATE_THRESHOLDS,
  isHourRideable,
  msToKnots,
  type HourlyForecast,
  type Spot,
  type Verdict,
} from "@windsiren/shared";
import { supabase } from "../../lib/supabase";
import {
  dbRowToSpot,
  fetch3DayForecast,
  formatDayLabel,
  formatHourLabel,
  groupHoursByLocalDay,
  type DayGroup,
} from "../../lib/spots";

type Loaded = {
  spot: Spot;
  days: DayGroup[];
};

export default function SpotDetailScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setError(null);
      setLoaded(null);

      const { data: row, error: dbErr } = await supabase
        .from("spots")
        .select("*")
        .eq("slug", slug)
        .eq("active", true)
        .maybeSingle();
      if (cancelled) return;
      if (dbErr) {
        setError(dbErr.message);
        return;
      }
      if (!row) {
        setError("Spot not found");
        return;
      }
      const spot = dbRowToSpot(row);

      try {
        const hours = await fetch3DayForecast(spot);
        if (cancelled) return;
        const days = groupHoursByLocalDay(hours).slice(0, 3);
        setLoaded({ spot, days });
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  return (
    <SafeAreaView style={styles.container} edges={["bottom"]}>
      <Stack.Screen options={{ title: loaded?.spot.name ?? "" }} />
      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorTitle}>Couldn't load spot</Text>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : !loaded ? (
        <ActivityIndicator style={styles.loader} size="large" />
      ) : (
        <ScrollView contentContainerStyle={styles.scroll}>
          <SpotHeader spot={loaded.spot} />
          {loaded.days.map((day) => (
            <DaySection key={day.dateKey} spot={loaded.spot} day={day} />
          ))}
          <View style={{ height: 40 }} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function SpotHeader({ spot }: { spot: Spot }) {
  return (
    <View style={styles.headerBox}>
      <View style={styles.titleLine}>
        <Text style={styles.title}>{spot.name}</Text>
        {spot.tideSensitive ? (
          <View style={styles.tideBadge}>
            <Text style={styles.tideBadgeText}>Tide sensitive</Text>
          </View>
        ) : null}
      </View>
      <Text style={styles.meta}>
        {spot.lat.toFixed(5)}°N, {spot.lng.toFixed(5)}°E · Netherlands
      </Text>
      <Text style={styles.meta}>
        Intermediate profile · safe wind{" "}
        {spot.safeWindDirections.map((r) => `${r.from}°–${r.to}°`).join(", ")}
      </Text>
      {spot.hazards ? <Text style={styles.hazard}>⚠ {spot.hazards}</Text> : null}
    </View>
  );
}

function DaySection({ spot, day }: { spot: Spot; day: DayGroup }) {
  const verdict = evaluateDay({ spot, hours: day.hours, thresholds: INTERMEDIATE_THRESHOLDS });
  const rideableCount = day.hours.filter((h) =>
    isHourRideable(h, spot, INTERMEDIATE_THRESHOLDS),
  ).length;

  return (
    <View style={styles.daySection}>
      <View style={styles.dayHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.dayTitle}>{formatDayLabel(day.dateKey)}</Text>
          <Text style={styles.daySub}>
            {rideableCount} rideable {rideableCount === 1 ? "hour" : "hours"}
          </Text>
        </View>
        <VerdictPill verdict={verdict} />
      </View>

      <View style={styles.table}>
        <View style={[styles.tableRow, styles.tableHeader]}>
          <Text style={[styles.cell, styles.cellTime, styles.cellHeader]}>Time</Text>
          <Text style={[styles.cell, styles.cellWind, styles.cellHeader]}>Wind</Text>
          <Text style={[styles.cell, styles.cellGust, styles.cellHeader]}>Gust</Text>
          <Text style={[styles.cell, styles.cellDir, styles.cellHeader]}>Dir</Text>
          <Text style={[styles.cell, styles.cellTemp, styles.cellHeader]}>Air</Text>
          <Text style={[styles.cell, styles.cellRide, styles.cellHeader]}>•</Text>
        </View>
        {day.hours.map((h) => (
          <HourRow key={h.time} hour={h} spot={spot} />
        ))}
      </View>
    </View>
  );
}

function HourRow({ hour, spot }: { hour: HourlyForecast; spot: Spot }) {
  const rideable = isHourRideable(hour, spot, INTERMEDIATE_THRESHOLDS);
  return (
    <View style={styles.tableRow}>
      <Text style={[styles.cell, styles.cellTime, styles.cellMono]}>
        {formatHourLabel(hour.time)}
      </Text>
      <Text style={[styles.cell, styles.cellWind, styles.cellMono]}>
        {msToKnots(hour.windSpeedMs).toFixed(0)}
      </Text>
      <Text style={[styles.cell, styles.cellGust, styles.cellMono, styles.cellMuted]}>
        {msToKnots(hour.gustMs).toFixed(0)}
      </Text>
      <Text style={[styles.cell, styles.cellDir]}>{cardinalDirection(hour.windDirectionDeg)}</Text>
      <Text style={[styles.cell, styles.cellTemp, styles.cellMono, styles.cellMuted]}>
        {hour.airTempC.toFixed(0)}°
      </Text>
      <View style={styles.cellRide}>
        <View
          style={[
            styles.dot,
            { backgroundColor: rideable ? "#10b981" : "#d4d4d8" },
          ]}
        />
      </View>
    </View>
  );
}

function VerdictPill({ verdict }: { verdict: Verdict }) {
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
  scroll: { padding: 16 },
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
  headerBox: { marginBottom: 24 },
  titleLine: { flexDirection: "row", alignItems: "center", gap: 10 },
  title: { fontSize: 26, fontWeight: "700" },
  meta: { fontSize: 12, color: "#6b7280", marginTop: 4 },
  hazard: { fontSize: 13, color: "#b45309", marginTop: 8 },
  tideBadge: {
    backgroundColor: "#dbeafe",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  tideBadgeText: { fontSize: 10, color: "#1e40af", fontWeight: "600" },
  daySection: { marginBottom: 24 },
  dayHeader: { flexDirection: "row", alignItems: "center", marginBottom: 8 },
  dayTitle: { fontSize: 16, fontWeight: "600" },
  daySub: { fontSize: 11, color: "#6b7280", marginTop: 2 },
  table: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#e5e5e5",
    borderRadius: 8,
    overflow: "hidden",
  },
  tableRow: {
    flexDirection: "row",
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#f0f0f0",
    alignItems: "center",
  },
  tableHeader: { backgroundColor: "#fafafa" },
  cellHeader: { fontSize: 10, color: "#6b7280", textTransform: "uppercase", fontWeight: "600" },
  cell: { fontSize: 12 },
  cellMono: { fontVariant: ["tabular-nums"] },
  cellMuted: { color: "#6b7280" },
  cellTime: { width: 48 },
  cellWind: { width: 44 },
  cellGust: { width: 44 },
  cellDir: { width: 44 },
  cellTemp: { width: 36 },
  cellRide: { flex: 1, alignItems: "flex-end" },
  dot: { width: 8, height: 8, borderRadius: 4 },
  verdictPill: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 999 },
  verdictText: { fontSize: 11, fontWeight: "700", letterSpacing: 0.5 },
});
