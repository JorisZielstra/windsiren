import { Link, Stack, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Svg, { Circle, G, Line, Path, Text as SvgText } from "react-native-svg";
import { type Spot, type TidePoint } from "@windsiren/shared";
import {
  addFavorite,
  addHomeSpot,
  cardinalLabelPositions,
  dbRowToSpot,
  fetchDailyTides,
  fetchLiveObservation,
  fetchSpotWeek,
  fetchHomeSpotIds,
  getUserPrefs,
  isHomeSpot,
  isSpotFavorited,
  needleEndpoint,
  prefsToThresholds,
  removeFavorite,
  removeHomeSpot,
  SUGGESTED_HOME_SPOT_MAX,
  safeSectorPaths,
  type LiveObservation,
  type SpotWeek,
} from "@windsiren/core";
import { CollapsibleSection } from "../../components/CollapsibleSection";
import { LiveObservationCard } from "../../components/LiveObservationCard";
import { SpotConditionsBlock } from "../../components/SpotConditionsBlock";
import { SpotSocial } from "../../components/SpotSocial";
import { WindguruDayTable } from "../../components/WindguruDayTable";
import { useAuth } from "../../lib/auth-context";
import { supabase } from "../../lib/supabase";

type Loaded = {
  spot: Spot;
  spotWeek: SpotWeek;
  todayKey: string;
  tideEvents: TidePoint[];
  live: LiveObservation | null;
};

function WindRose({
  safeDirections,
  currentWindDirectionDeg,
  size = 100,
}: {
  safeDirections: Spot["safeWindDirections"];
  currentWindDirectionDeg?: number | null;
  size?: number;
}) {
  const cx = size / 2;
  const cy = size / 2;
  const outer = size / 2 - 12;
  const labelR = size / 2 - 4;
  const labels = cardinalLabelPositions(cx, cy, labelR);
  const paths = safeSectorPaths(cx, cy, outer, safeDirections);
  const needleTip =
    typeof currentWindDirectionDeg === "number"
      ? needleEndpoint(cx, cy, outer - 3, currentWindDirectionDeg)
      : null;

  return (
    <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <Circle cx={cx} cy={cy} r={outer} fill="#fafafa" stroke="#e5e5e5" strokeWidth="1" />
      {paths.map((d, i) => (
        <Path key={i} d={d} fill="#a7f3d0" fillOpacity={0.6} stroke="#10b981" strokeOpacity={0.4} strokeWidth="1" />
      ))}
      {[0, 90, 180, 270].map((deg) => (
        <Line
          key={deg}
          x1={cx}
          y1={cy - outer + 2}
          x2={cx}
          y2={cy - outer + 6}
          stroke="#d4d4d8"
          strokeWidth="1"
          transform={`rotate(${deg} ${cx} ${cy})`}
        />
      ))}
      {needleTip ? (
        <G>
          <Line
            x1={cx}
            y1={cy}
            x2={needleTip.x}
            y2={needleTip.y}
            stroke="#0284c7"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <Circle cx={needleTip.x} cy={needleTip.y} r="3" fill="#0284c7" />
        </G>
      ) : null}
      <Circle cx={cx} cy={cy} r="2" fill="#9ca3af" />
      <SvgText x={labels.N.x} y={labels.N.y + 3} textAnchor="middle" fontSize="9" fontWeight="600" fill="#6b7280">N</SvgText>
      <SvgText x={labels.E.x} y={labels.E.y + 3} textAnchor="middle" fontSize="9" fontWeight="600" fill="#6b7280">E</SvgText>
      <SvgText x={labels.S.x} y={labels.S.y + 3} textAnchor="middle" fontSize="9" fontWeight="600" fill="#6b7280">S</SvgText>
      <SvgText x={labels.W.x} y={labels.W.y + 3} textAnchor="middle" fontSize="9" fontWeight="600" fill="#6b7280">W</SvgText>
    </Svg>
  );
}

export default function SpotDetailScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const { user } = useAuth();
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [error, setError] = useState<string | null>(null);
  const userId = user?.id ?? null;

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
        const userPrefs = await getUserPrefs(supabase, userId);
        if (cancelled) return;
        const userThresholds = prefsToThresholds(userPrefs);
        const [spotWeek, live] = await Promise.all([
          fetchSpotWeek(spot, 16, userThresholds),
          fetchLiveObservation(spot, process.env.EXPO_PUBLIC_KNMI_API_KEY),
        ]);
        if (cancelled) return;
        // Tide events for every day in the forecast window — drives
        // the integrated tide row inside the weather table.
        const tideDays = spotWeek.days.map((d) => d.dateKey);
        const tidesPerDay = await Promise.all(
          tideDays.map((dateKey) => fetchDailyTides(spot, dateKey)),
        );
        if (cancelled) return;
        const tideEvents = tidesPerDay.flat();
        const todayKey = nlLocalDateKey(new Date());
        setLoaded({ spot, spotWeek, todayKey, tideEvents, live });
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [slug, userId]);

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
          <SpotHeader
            spot={loaded.spot}
            liveDirection={loaded.live?.observation.windDirectionDeg ?? null}
          />
          <View style={styles.panelsCard}>
            {loaded.live ? (
              <LiveObservationCard live={loaded.live} spot={loaded.spot} />
            ) : null}
            {loaded.spotWeek.days.length > 0 ? (
              <View style={styles.panelDivider}>
                <CollapsibleSection
                  title={`Conditions for ${loaded.spot.name}`}
                  subtitle="Tap a day to pivot · tap a tile for hourly chart"
                >
                  <SpotConditionsBlock
                    spotWeek={loaded.spotWeek}
                    todayKey={loaded.todayKey}
                    headless
                  />
                </CollapsibleSection>
              </View>
            ) : null}
            {loaded.spotWeek.days.length > 0 ? (
              <View style={styles.panelDivider}>
                <CollapsibleSection
                  title={`Forecast — next ${loaded.spotWeek.days.length} days`}
                >
                  <WindguruDayTable
                    spot={loaded.spot}
                    hours={loaded.spotWeek.days.flatMap((d) => d.hours)}
                    tideEvents={loaded.tideEvents}
                  />
                </CollapsibleSection>
              </View>
            ) : null}
          </View>
          <SpotSocial spot={loaded.spot} />
          <View style={{ height: 40 }} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function SpotHeader({
  spot,
  liveDirection,
}: {
  spot: Spot;
  liveDirection: number | null;
}) {
  return (
    <View style={styles.headerBox}>
      <View style={styles.titleRow}>
        <View style={{ flex: 1 }}>
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
        </View>
        <View style={styles.spotButtonsCol}>
          <HomeSpotButton spotId={spot.id} />
          <FavoriteButton spotId={spot.id} />
        </View>
      </View>

      <View style={styles.windRoseRow}>
        <WindRose safeDirections={spot.safeWindDirections} currentWindDirectionDeg={liveDirection} />
        <View style={styles.windRoseLegend}>
          <View style={styles.legendRow}>
            <View style={styles.legendSwatchSafe} />
            <Text style={styles.legendLabel}>Safe wind arc</Text>
          </View>
          {liveDirection !== null ? (
            <View style={styles.legendRow}>
              <View style={styles.legendSwatchNeedle} />
              <Text style={styles.legendLabel}>
                Current wind ({Math.round(liveDirection)}°)
              </Text>
            </View>
          ) : null}
          <Text style={styles.legendDirs}>
            {spot.safeWindDirections.map((r) => `${r.from}°–${r.to}°`).join(", ")}
          </Text>
        </View>
      </View>

    </View>
  );
}

function FavoriteButton({ spotId }: { spotId: string }) {
  const { user } = useAuth();
  const [favorited, setFavorited] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      setFavorited(null);
      return;
    }
    let cancelled = false;
    isSpotFavorited(supabase, user.id, spotId).then((v) => {
      if (!cancelled) setFavorited(v);
    });
    return () => {
      cancelled = true;
    };
  }, [user, spotId]);

  if (!user) {
    return (
      <Link href="/sign-in" asChild>
        <Pressable style={styles.favBtn}>
          <Text style={styles.favBtnText}>☆ Sign in</Text>
        </Pressable>
      </Link>
    );
  }

  async function toggle() {
    if (!user || busy || favorited === null) return;
    setBusy(true);
    setMessage(null);
    const result = favorited
      ? await removeFavorite(supabase, user.id, spotId)
      : await addFavorite(supabase, user.id, spotId);
    setBusy(false);
    if (result.ok) {
      setFavorited(result.favorited);
    } else if (result.reason === "limit_reached") {
      setMessage("Free plan: 1 favorite. Multi-spot coming soon.");
    } else {
      setMessage(`Couldn't update: ${result.message}`);
    }
  }

  return (
    <View style={{ alignItems: "flex-end" }}>
      <Pressable
        onPress={toggle}
        disabled={busy || favorited === null}
        style={[styles.favBtn, favorited ? styles.favBtnActive : null, busy && { opacity: 0.5 }]}
      >
        <Text style={favorited ? styles.favBtnActiveText : styles.favBtnText}>
          {favorited === null ? "…" : favorited ? "★ Favorited" : "☆ Favorite"}
        </Text>
      </Pressable>
      {message ? <Text style={styles.favMessage}>{message}</Text> : null}
    </View>
  );
}

function HomeSpotButton({ spotId }: { spotId: string }) {
  const { user } = useAuth();
  const [home, setHome] = useState<boolean | null>(null);
  const [count, setCount] = useState<number>(0);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      setHome(null);
      return;
    }
    let cancelled = false;
    Promise.all([
      isHomeSpot(supabase, user.id, spotId),
      fetchHomeSpotIds(supabase, user.id),
    ]).then(([h, ids]) => {
      if (cancelled) return;
      setHome(h);
      setCount(ids.size);
    });
    return () => {
      cancelled = true;
    };
  }, [user, spotId]);

  if (!user) {
    return (
      <Link href="/sign-in" asChild>
        <Pressable style={styles.homeBtn}>
          <Text style={styles.homeBtnText}>🏠 Sign in</Text>
        </Pressable>
      </Link>
    );
  }

  async function toggle() {
    if (!user || busy || home === null) return;
    setBusy(true);
    setMessage(null);
    const result = home
      ? await removeHomeSpot(supabase, user.id, spotId)
      : await addHomeSpot(supabase, user.id, spotId);
    setBusy(false);
    if (result.ok) {
      setHome(result.isHome);
      const nextCount = count + (result.isHome ? 1 : -1);
      setCount(nextCount);
      if (result.isHome && nextCount > SUGGESTED_HOME_SPOT_MAX) {
        setMessage(
          `${nextCount} home spots — we suggest 1–${SUGGESTED_HOME_SPOT_MAX}.`,
        );
      }
    } else {
      setMessage(`Couldn't update: ${result.message}`);
    }
  }

  return (
    <View style={{ alignItems: "flex-end" }}>
      <Pressable
        onPress={toggle}
        disabled={busy || home === null}
        style={[styles.homeBtn, home ? styles.homeBtnActive : null, busy && { opacity: 0.5 }]}
      >
        <Text style={home ? styles.homeBtnActiveText : styles.homeBtnText}>
          {home === null ? "…" : home ? "🏠 Home spot" : "🏠 Set as home"}
        </Text>
      </Pressable>
      {message ? <Text style={styles.favMessage}>{message}</Text> : null}
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
  headerBox: { marginBottom: 16 },
  titleRow: { flexDirection: "row", gap: 12 },
  windRoseRow: { flexDirection: "row", alignItems: "center", gap: 16, marginTop: 14 },
  windRoseLegend: { flex: 1, gap: 4 },
  legendRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  legendSwatchSafe: {
    width: 10,
    height: 10,
    borderRadius: 2,
    backgroundColor: "#a7f3d0",
    borderWidth: 1,
    borderColor: "#10b981",
  },
  legendSwatchNeedle: { width: 10, height: 10, borderRadius: 5, backgroundColor: "#0284c7" },
  legendLabel: { fontSize: 12, color: "#4b5563" },
  legendDirs: { fontSize: 11, fontFamily: "Menlo", color: "#6b7280", marginTop: 6 },
  favBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#d4d4d8",
    backgroundColor: "#fff",
  },
  favBtnActive: { borderColor: "#fbbf24", backgroundColor: "#fef3c7" },
  favBtnText: { fontSize: 13, fontWeight: "600", color: "#18181b" },
  favBtnActiveText: { fontSize: 13, fontWeight: "600", color: "#78350f" },
  favMessage: { marginTop: 6, fontSize: 10, color: "#6b7280", maxWidth: 160, textAlign: "right" },
  spotButtonsCol: { gap: 8, alignItems: "flex-end" },
  homeBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#d4d4d8",
    backgroundColor: "#fff",
  },
  homeBtnActive: { borderColor: "#10b981", backgroundColor: "#ecfdf5" },
  homeBtnText: { fontSize: 13, fontWeight: "600", color: "#18181b" },
  homeBtnActiveText: { fontSize: 13, fontWeight: "600", color: "#065f46" },
  panelsCard: {
    marginVertical: 16,
    borderRadius: 12,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e4e4e7",
    overflow: "hidden",
  },
  panelDivider: {
    borderTopWidth: 1,
    borderTopColor: "#f4f4f5",
  },
  titleLine: { flexDirection: "row", alignItems: "center", gap: 10 },
  title: { fontSize: 26, fontWeight: "700" },
  meta: { fontSize: 12, color: "#6b7280", marginTop: 4 },
  tideBadge: {
    backgroundColor: "#dbeafe",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  tideBadgeText: { fontSize: 10, color: "#1e40af", fontWeight: "600" },
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

function nlLocalDateKey(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Amsterdam",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}
