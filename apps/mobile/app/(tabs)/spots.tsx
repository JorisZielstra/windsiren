import { Link, useFocusEffect } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  dbRowToSpot,
  fetchSpotWeek,
  getUserPrefs,
  peakWindMs,
  prefsToThresholds,
  type SpotWithVerdict,
} from "@windsiren/core";
import {
  directionInAnyRange,
  msToKnots,
  type SpotRegion,
} from "@windsiren/shared";
import { VerdictPill } from "../../components/VerdictPill";
import { useAuth } from "../../lib/auth-context";
import { supabase } from "../../lib/supabase";

const DIRECTIONS: { label: string; deg: number }[] = [
  { label: "N", deg: 0 },
  { label: "NE", deg: 45 },
  { label: "E", deg: 90 },
  { label: "SE", deg: 135 },
  { label: "S", deg: 180 },
  { label: "SW", deg: 225 },
  { label: "W", deg: 270 },
  { label: "NW", deg: 315 },
];

const REGIONS: { value: SpotRegion; label: string }[] = [
  { value: "wadden", label: "Wadden" },
  { value: "north_holland", label: "North Holland" },
  { value: "south_holland", label: "South Holland" },
  { value: "zeeland", label: "Zeeland" },
  { value: "ijsselmeer", label: "IJsselmeer" },
];

type TideFilter = "any" | "only_tide" | "only_no_tide";
type SortKey = "verdict" | "wind" | "name";

const SORTS: { value: SortKey; label: string }[] = [
  { value: "verdict", label: "Best today" },
  { value: "wind", label: "Strongest wind" },
  { value: "name", label: "A → Z" },
];

export default function SpotsScreen() {
  const [items, setItems] = useState<SpotWithVerdict[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedDirs, setSelectedDirs] = useState<Set<number>>(new Set());
  const [tideFilter, setTideFilter] = useState<TideFilter>("any");
  const [regionFilter, setRegionFilter] = useState<SpotRegion | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("verdict");
  const { user } = useAuth();
  const userId = user?.id ?? null;

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
        const todayKey = nlLocalDateKey(new Date());
        const userPrefs = await getUserPrefs(supabase, userId);
        if (cancelled) return;
        const userThresholds = prefsToThresholds(userPrefs);
        const weeks = await Promise.all(
          spots.map((s) => fetchSpotWeek(s, 1, userThresholds)),
        );
        if (cancelled) return;
        const todayItems: SpotWithVerdict[] = weeks.map((week) => {
          const today = week.days.find((d) => d.dateKey === todayKey) ?? week.days[0];
          return {
            spot: week.spot,
            verdict: today?.verdict ?? null,
            hours: today?.hours ?? [],
          };
        });
        setItems(todayItems);
      })();
      return () => {
        cancelled = true;
      };
    }, [userId]),
  );

  const sorted = useMemo(() => {
    if (!items) return [];
    const filtered = items.filter((it) => {
      if (regionFilter && it.spot.region !== regionFilter) return false;
      if (tideFilter === "only_tide" && !it.spot.tideSensitive) return false;
      if (tideFilter === "only_no_tide" && it.spot.tideSensitive) return false;
      if (selectedDirs.size > 0) {
        const matchesAny = Array.from(selectedDirs).some((deg) =>
          directionInAnyRange(deg, it.spot.safeWindDirections),
        );
        if (!matchesAny) return false;
      }
      return true;
    });
    const score = (item: SpotWithVerdict): number => {
      if (item.verdict?.decision === "go") return 3;
      if (item.verdict?.decision === "marginal") return 2;
      if (item.verdict?.decision === "no_go") return 1;
      return 0;
    };
    return [...filtered].sort((a, b) => {
      if (sortKey === "name") return a.spot.name.localeCompare(b.spot.name);
      if (sortKey === "wind") {
        const peakA = peakWindMs(a.hours) ?? -1;
        const peakB = peakWindMs(b.hours) ?? -1;
        const d = peakB - peakA;
        if (d !== 0) return d;
        return a.spot.name.localeCompare(b.spot.name);
      }
      const d = score(b) - score(a);
      if (d !== 0) return d;
      return a.spot.name.localeCompare(b.spot.name);
    });
  }, [items, selectedDirs, tideFilter, regionFilter, sortKey]);

  const filtersActive =
    selectedDirs.size > 0 || tideFilter !== "any" || regionFilter !== null;

  function toggleDir(deg: number) {
    setSelectedDirs((prev) => {
      const next = new Set(prev);
      if (next.has(deg)) next.delete(deg);
      else next.add(deg);
      return next;
    });
  }

  function clearFilters() {
    setSelectedDirs(new Set());
    setTideFilter("any");
    setRegionFilter(null);
  }

  return (
    <SafeAreaView style={styles.container} edges={["bottom"]}>
      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorTitle}>Something went wrong</Text>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : !items ? (
        <ActivityIndicator style={styles.loader} size="large" />
      ) : (
        <ScrollView contentContainerStyle={styles.scroll}>
          <View style={styles.header}>
            <Text style={styles.title}>Spots</Text>
            <Text style={styles.subtitle}>
              {sorted.length} of {items.length} NL spots
              {filtersActive ? " match your filters" : ""}
            </Text>
          </View>

          <View style={styles.filterStack}>
            <FilterRow label="Wind direction">
              {DIRECTIONS.map((d) => (
                <Chip
                  key={d.label}
                  label={d.label}
                  active={selectedDirs.has(d.deg)}
                  onPress={() => toggleDir(d.deg)}
                />
              ))}
            </FilterRow>
            <FilterRow label="Tide">
              <Chip
                label="Any"
                active={tideFilter === "any"}
                onPress={() => setTideFilter("any")}
              />
              <Chip
                label="Tide-sensitive"
                active={tideFilter === "only_tide"}
                onPress={() => setTideFilter("only_tide")}
              />
              <Chip
                label="Inland / no tide"
                active={tideFilter === "only_no_tide"}
                onPress={() => setTideFilter("only_no_tide")}
              />
            </FilterRow>
            <FilterRow label="Region">
              <Chip
                label="All"
                active={regionFilter === null}
                onPress={() => setRegionFilter(null)}
              />
              {REGIONS.map((r) => (
                <Chip
                  key={r.value}
                  label={r.label}
                  active={regionFilter === r.value}
                  onPress={() => setRegionFilter(r.value)}
                />
              ))}
            </FilterRow>
            <FilterRow label="Sort by">
              {SORTS.map((s) => (
                <Chip
                  key={s.value}
                  label={s.label}
                  active={sortKey === s.value}
                  onPress={() => setSortKey(s.value)}
                />
              ))}
            </FilterRow>
          </View>

          {sorted.length === 0 ? (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyTitle}>No matching spots.</Text>
              <Pressable onPress={clearFilters}>
                <Text style={styles.emptyClear}>Clear filters →</Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.list}>
              {sorted.map((item) => (
                <SpotRow key={item.spot.id} item={item} />
              ))}
            </View>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function FilterRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <View>
      <Text style={styles.filterLabel}>{label.toUpperCase()}</Text>
      <View style={styles.chipRow}>{children}</View>
    </View>
  );
}

function Chip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        active && styles.chipActive,
        pressed && styles.chipPressed,
      ]}
    >
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </Pressable>
  );
}

function SpotRow({ item }: { item: SpotWithVerdict }) {
  const peak = peakWindMs(item.hours);
  return (
    <Link href={`/spots/${item.spot.slug}`} asChild>
      <Pressable
        style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
      >
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
            {item.spot.region ? `${regionLabel(item.spot.region)} · ` : ""}
            {item.spot.lat.toFixed(3)}°N, {item.spot.lng.toFixed(3)}°E
            {peak !== null ? `  ·  peak ${msToKnots(peak).toFixed(0)} kn` : ""}
          </Text>
        </View>
        <VerdictPill verdict={item.verdict} />
      </Pressable>
    </Link>
  );
}

function regionLabel(region: SpotRegion): string {
  return REGIONS.find((r) => r.value === region)?.label ?? region;
}

function nlLocalDateKey(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Amsterdam",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
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
  scroll: { paddingBottom: 24 },
  header: { paddingHorizontal: 20, paddingTop: 12 },
  title: { fontSize: 24, fontWeight: "700", color: "#18181b" },
  subtitle: { marginTop: 2, fontSize: 12, color: "#71717a" },
  filterStack: { paddingHorizontal: 20, paddingTop: 16, gap: 12 },
  filterLabel: {
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 0.6,
    color: "#71717a",
    marginBottom: 6,
  },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#d4d4d8",
    backgroundColor: "#fff",
  },
  chipActive: { borderColor: "#10b981", backgroundColor: "#ecfdf5" },
  chipPressed: { opacity: 0.6 },
  chipText: { fontSize: 12, color: "#3f3f46", fontWeight: "500" },
  chipTextActive: { color: "#065f46" },
  emptyBox: { margin: 20, padding: 24, alignItems: "center" },
  emptyTitle: { fontSize: 14, color: "#71717a" },
  emptyClear: { marginTop: 8, fontSize: 13, color: "#059669", fontWeight: "600" },
  list: { marginTop: 16 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#f0f0f0",
  },
  rowPressed: { backgroundColor: "#f4f4f5" },
  rowMain: { flex: 1 },
  rowTitleLine: { flexDirection: "row", alignItems: "center", gap: 8 },
  rowTitle: { fontSize: 15, fontWeight: "500", color: "#18181b" },
  rowSub: { fontSize: 12, color: "#6b7280", marginTop: 2 },
  tideBadge: {
    backgroundColor: "#dbeafe",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  tideBadgeText: { fontSize: 10, color: "#1e40af", fontWeight: "600" },
});
