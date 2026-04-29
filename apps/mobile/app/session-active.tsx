import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { useKeepAwake } from "expo-keep-awake";
import * as Location from "expo-location";
import { Accelerometer } from "expo-sensors";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  accelMagnitudeG,
  createSession,
  dbRowToSpot,
  haversineMeters,
  JumpDetector,
  msToKnots,
  saveSessionTrack,
  type DetectedJump,
  type TrackPoint,
} from "@windsiren/core";
import type { Spot } from "@windsiren/shared";
import { useAuth } from "../lib/auth-context";
import { supabase } from "../lib/supabase";

// Live kite-session tracker. Foreground-only for v1: phone must stay
// on screen (we keep it awake) and the app must be open. GPS gives
// speed + distance + polyline; the device accelerometer feeds a
// streaming jump detector. On a detected jump we buzz N times where
// N = floor(jump height in meters) — the user feels the jump scale
// without looking at the phone.
//
// "End session" → SaveSessionModal on `/session-active`'s sibling
// state which writes a sessions row + linked session_tracks row.

const ACCEL_HZ = 50; // 20ms — plenty for kite jumps (0.5–3s airtime)
const GPS_DISTANCE_INTERVAL_M = 3; // sample every 3m of movement
const GPS_TIME_INTERVAL_MS = 1000; // …or every 1s, whichever first
const POLYLINE_SAMPLE_INTERVAL_MS = 2000; // down-sample polyline to 1/2s
const MAX_BUZZES = 10; // cap haptic feedback for sanity

export default function SessionActiveScreen() {
  useKeepAwake();
  const router = useRouter();
  const { user } = useAuth();
  const params = useLocalSearchParams<{ spotId?: string }>();

  // Live state
  const [startedAt] = useState<number>(() => Date.now());
  const [now, setNow] = useState<number>(() => Date.now());
  const [topSpeedMs, setTopSpeedMs] = useState<number>(0);
  const [currentSpeedMs, setCurrentSpeedMs] = useState<number>(0);
  const [distanceM, setDistanceM] = useState<number>(0);
  const [jumps, setJumps] = useState<DetectedJump[]>([]);
  const [permissionError, setPermissionError] = useState<string | null>(null);

  // Mutable refs that don't need to trigger re-render.
  const runningRef = useRef<boolean>(true);
  const polylineRef = useRef<TrackPoint[]>([]);
  const lastPolyMsRef = useRef<number>(0);
  const lastPosRef = useRef<{ lat: number; lng: number } | null>(null);
  const detectorRef = useRef<JumpDetector | null>(null);
  const locationSubRef = useRef<Location.LocationSubscription | null>(null);
  const [endOpen, setEndOpen] = useState<boolean>(false);

  // Wall-clock tick — refreshes the on-screen clock + session timer.
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // Buzz N times for an N-meter jump. 200ms between impacts so the
  // user can count the pulses without them blurring together.
  const buzzForJump = useCallback(async (heightM: number) => {
    const count = Math.min(MAX_BUZZES, Math.floor(heightM));
    if (count <= 0) return;
    for (let i = 0; i < count; i++) {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      if (i < count - 1) await sleep(200);
    }
  }, []);

  // Permission + sensor wiring on mount.
  useEffect(() => {
    let cancelled = false;
    let accelSub: { remove: () => void } | null = null;

    detectorRef.current = new JumpDetector((jump) => {
      if (cancelled) return;
      setJumps((prev) => [...prev, jump]);
      void buzzForJump(jump.heightM);
    });

    (async () => {
      // Location permission (foreground)
      const loc = await Location.requestForegroundPermissionsAsync();
      if (cancelled) return;
      if (loc.status !== "granted") {
        setPermissionError(
          "Location permission denied. Open Settings → WindSiren → Location to enable.",
        );
        return;
      }

      // Streaming GPS — speed comes back already in m/s.
      try {
        locationSubRef.current = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.BestForNavigation,
            distanceInterval: GPS_DISTANCE_INTERVAL_M,
            timeInterval: GPS_TIME_INTERVAL_MS,
          },
          (pos) => onLocation(pos),
        );
      } catch (err) {
        if (!cancelled) {
          setPermissionError(err instanceof Error ? err.message : String(err));
        }
        return;
      }

      // Accelerometer — measure in g's already (expo-sensors default).
      Accelerometer.setUpdateInterval(Math.round(1000 / ACCEL_HZ));
      accelSub = Accelerometer.addListener((data) => {
        if (cancelled || !runningRef.current) return;
        const mag = accelMagnitudeG(data.x, data.y, data.z);
        detectorRef.current?.push({ mag, t: Date.now() });
      });
    })();

    return () => {
      cancelled = true;
      accelSub?.remove();
      locationSubRef.current?.remove();
      locationSubRef.current = null;
    };
    // We intentionally only run this once on mount — pause/resume isn't
    // wired in v1; the user ends the session to stop tracking.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function onLocation(pos: Location.LocationObject) {
    const speed = Math.max(0, pos.coords.speed ?? 0);
    setCurrentSpeedMs(speed);
    setTopSpeedMs((prev) => (speed > prev ? speed : prev));

    const last = lastPosRef.current;
    if (last) {
      const d = haversineMeters(
        last.lat,
        last.lng,
        pos.coords.latitude,
        pos.coords.longitude,
      );
      // Drop tiny GPS jitter when standing still.
      if (d > 1) setDistanceM((prev) => prev + d);
    }
    lastPosRef.current = {
      lat: pos.coords.latitude,
      lng: pos.coords.longitude,
    };

    // Polyline down-sample
    const tNow = Date.now();
    if (tNow - lastPolyMsRef.current >= POLYLINE_SAMPLE_INTERVAL_MS) {
      lastPolyMsRef.current = tNow;
      polylineRef.current.push({
        t: new Date(pos.timestamp ?? tNow).toISOString(),
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        speed,
      });
    }
  }

  const elapsedMs = now - startedAt;
  const maxJumpM = useMemo(
    () => jumps.reduce((max, j) => (j.heightM > max ? j.heightM : max), 0),
    [jumps],
  );
  const lastJump = jumps.length > 0 ? jumps[jumps.length - 1]! : null;

  function endSession() {
    runningRef.current = false;
    setEndOpen(true);
  }

  function discard() {
    Alert.alert(
      "Discard session?",
      "All recorded data will be lost.",
      [
        { text: "Keep", style: "cancel" },
        {
          text: "Discard",
          style: "destructive",
          onPress: () => router.back(),
        },
      ],
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.headerRow}>
          <Text style={styles.title}>SESSION</Text>
          <Text style={styles.clock}>{formatClock(new Date(now))}</Text>
        </View>

        {permissionError ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{permissionError}</Text>
          </View>
        ) : null}

        <View style={styles.heroBox}>
          <Text style={styles.heroLabel}>Session time</Text>
          <Text style={styles.heroValue}>{formatDuration(elapsedMs)}</Text>
        </View>

        <View style={styles.tilesRow}>
          <Tile label="Top speed" value={`${msToKnots(topSpeedMs).toFixed(1)} kn`} />
          <Tile label="Now" value={`${msToKnots(currentSpeedMs).toFixed(1)} kn`} />
        </View>
        <View style={styles.tilesRow}>
          <Tile label="Distance" value={`${(distanceM / 1000).toFixed(2)} km`} />
          <Tile label="Highest jump" value={`${maxJumpM.toFixed(1)} m`} />
        </View>

        <View style={styles.jumpsBox}>
          <Text style={styles.sectionLabel}>
            Jumps · {jumps.length}
          </Text>
          {lastJump ? (
            <Text style={styles.lastJumpText}>
              Last: {lastJump.heightM.toFixed(1)} m · {lastJump.airtimeS.toFixed(2)}s air
            </Text>
          ) : (
            <Text style={styles.muted}>None yet — boost it.</Text>
          )}
          <View style={styles.jumpsList}>
            {jumps
              .slice()
              .reverse()
              .slice(0, 5)
              .map((j, i) => (
                <Text key={i} style={styles.jumpRow}>
                  · {j.heightM.toFixed(1)} m ({j.airtimeS.toFixed(2)}s)
                </Text>
              ))}
          </View>
        </View>

        <View style={styles.actions}>
          <Pressable
            style={({ pressed }) => [styles.endBtn, pressed && { opacity: 0.85 }]}
            onPress={endSession}
          >
            <Text style={styles.endBtnText}>End session</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.discardBtn, pressed && { opacity: 0.85 }]}
            onPress={discard}
          >
            <Text style={styles.discardBtnText}>Discard</Text>
          </Pressable>
        </View>
      </ScrollView>

      {endOpen && user ? (
        <SaveSessionModal
          startedAt={startedAt}
          endedAt={now}
          topSpeedMs={topSpeedMs}
          distanceM={distanceM}
          jumps={jumps}
          polyline={polylineRef.current}
          userId={user.id}
          initialSpotId={params.spotId ?? null}
          onClose={() => setEndOpen(false)}
          onSaved={(spotSlug) => {
            setEndOpen(false);
            router.replace(spotSlug ? `/spots/${spotSlug}` : "/(tabs)/profile");
          }}
        />
      ) : null}
    </SafeAreaView>
  );
}

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.tile}>
      <Text style={styles.tileLabel}>{label}</Text>
      <Text style={styles.tileValue}>{value}</Text>
    </View>
  );
}

function SaveSessionModal({
  startedAt,
  endedAt,
  topSpeedMs,
  distanceM,
  jumps,
  polyline,
  userId,
  initialSpotId,
  onClose,
  onSaved,
}: {
  startedAt: number;
  endedAt: number;
  topSpeedMs: number;
  distanceM: number;
  jumps: DetectedJump[];
  polyline: TrackPoint[];
  userId: string;
  initialSpotId: string | null;
  onClose: () => void;
  onSaved: (spotSlug: string | null) => void;
}) {
  const [spots, setSpots] = useState<Spot[] | null>(null);
  const [spotId, setSpotId] = useState<string | null>(initialSpotId);
  const [busy, setBusy] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const maxJumpM = useMemo(
    () => jumps.reduce((max, j) => (j.heightM > max ? j.heightM : max), 0),
    [jumps],
  );
  const durationMin = Math.max(1, Math.round((endedAt - startedAt) / 60_000));

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("spots")
        .select("*")
        .eq("active", true)
        .order("name");
      if (cancelled) return;
      setSpots((data ?? []).map(dbRowToSpot));
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function save() {
    if (!spotId) {
      setError("Pick the spot you kited at.");
      return;
    }
    setBusy(true);
    setError(null);
    const sessionDate = new Date(startedAt).toISOString().slice(0, 10);
    const sessionResult = await createSession(supabase, {
      userId,
      spotId,
      sessionDate,
      durationMinutes: durationMin,
      windAvgMs: null,
      windMaxMs: null,
      windDirAvgDeg: null,
      gustMaxMs: null,
      maxJumpM: maxJumpM > 0 ? maxJumpM : null,
      notes: null,
    });
    if (!sessionResult.ok) {
      setBusy(false);
      setError(sessionResult.message);
      return;
    }
    const trackResult = await saveSessionTrack(supabase, {
      sessionId: sessionResult.session.id,
      userId,
      topSpeedMs,
      distanceM,
      jumpCount: jumps.length,
      maxJumpM,
      polyline,
      jumps,
    });
    setBusy(false);
    if (!trackResult.ok) {
      setError(`Saved session but track failed: ${trackResult.message}`);
      return;
    }
    const spotSlug = spots?.find((s) => s.id === spotId)?.slug ?? null;
    onSaved(spotSlug);
  }

  return (
    <View style={styles.modalBackdrop}>
      <View style={styles.sheet}>
        <View style={styles.sheetHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.sheetLabel}>Save session</Text>
            <Text style={styles.sheetTitle}>
              {durationMin} min · {(distanceM / 1000).toFixed(1)} km · {jumps.length} jumps
            </Text>
          </View>
          <Pressable onPress={onClose} hitSlop={12}>
            <Text style={styles.closeBtn}>×</Text>
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.sheetBody}>
          <Text style={styles.sectionLabel}>Spot</Text>
          {spots === null ? (
            <Text style={styles.muted}>Loading spots…</Text>
          ) : (
            <View style={styles.chipRow}>
              {spots.map((s) => (
                <Pressable
                  key={s.id}
                  onPress={() => setSpotId(s.id)}
                  style={({ pressed }) => [
                    styles.chip,
                    spotId === s.id && styles.chipActive,
                    pressed && { opacity: 0.6 },
                  ]}
                >
                  <Text
                    style={[
                      styles.chipText,
                      spotId === s.id && styles.chipTextActive,
                    ]}
                  >
                    {s.name}
                  </Text>
                </Pressable>
              ))}
            </View>
          )}

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <View style={styles.actions}>
            <Pressable
              onPress={save}
              disabled={busy || !spotId}
              style={({ pressed }) => [
                styles.endBtn,
                (busy || !spotId) && { opacity: 0.5 },
                pressed && { opacity: 0.85 },
              ]}
            >
              <Text style={styles.endBtnText}>{busy ? "Saving…" : "Save"}</Text>
            </Pressable>
          </View>
        </ScrollView>
      </View>
    </View>
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((res) => setTimeout(res, ms));
}

function formatClock(d: Date): string {
  return d.toLocaleTimeString("en-NL", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

function formatDuration(ms: number): string {
  const totalS = Math.floor(ms / 1000);
  const h = Math.floor(totalS / 3600);
  const m = Math.floor((totalS % 3600) / 60);
  const s = totalS % 60;
  if (h > 0) {
    return `${h}:${pad2(m)}:${pad2(s)}`;
  }
  return `${pad2(m)}:${pad2(s)}`;
}

function pad2(n: number): string {
  return n.toString().padStart(2, "0");
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0a0a0a" },
  scroll: { padding: 20, gap: 16 },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  title: {
    color: "#10b981",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 2,
  },
  clock: {
    color: "#a1a1aa",
    fontSize: 14,
    fontVariant: ["tabular-nums"],
  },
  errorBox: {
    backgroundColor: "#7f1d1d",
    borderRadius: 8,
    padding: 12,
  },
  errorText: { color: "#fee2e2", fontSize: 13 },
  heroBox: {
    backgroundColor: "#18181b",
    borderRadius: 16,
    padding: 24,
    alignItems: "center",
  },
  heroLabel: {
    color: "#71717a",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.5,
    textTransform: "uppercase",
  },
  heroValue: {
    color: "#fff",
    fontSize: 56,
    fontWeight: "800",
    fontVariant: ["tabular-nums"],
    marginTop: 8,
  },
  tilesRow: { flexDirection: "row", gap: 12 },
  tile: {
    flex: 1,
    backgroundColor: "#18181b",
    borderRadius: 12,
    padding: 16,
  },
  tileLabel: {
    color: "#71717a",
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  tileValue: {
    color: "#fff",
    fontSize: 28,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
    marginTop: 4,
  },
  jumpsBox: {
    backgroundColor: "#18181b",
    borderRadius: 12,
    padding: 16,
  },
  sectionLabel: {
    color: "#71717a",
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  lastJumpText: {
    color: "#10b981",
    fontSize: 18,
    fontWeight: "700",
    marginTop: 6,
    fontVariant: ["tabular-nums"],
  },
  muted: { color: "#71717a", fontSize: 13, marginTop: 6 },
  jumpsList: { marginTop: 8 },
  jumpRow: {
    color: "#a1a1aa",
    fontSize: 13,
    fontVariant: ["tabular-nums"],
    marginTop: 2,
  },
  actions: { gap: 10, marginTop: 8 },
  endBtn: {
    backgroundColor: "#dc2626",
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
  },
  endBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  discardBtn: {
    backgroundColor: "transparent",
    borderColor: "#27272a",
    borderWidth: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  discardBtnText: { color: "#a1a1aa", fontSize: 14 },
  modalBackdrop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: "85%",
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f4f4f5",
    gap: 12,
  },
  sheetLabel: {
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 1.2,
    color: "#71717a",
    textTransform: "uppercase",
  },
  sheetTitle: { fontSize: 17, fontWeight: "600", color: "#18181b", marginTop: 2 },
  closeBtn: { fontSize: 28, lineHeight: 28, color: "#a1a1aa", paddingHorizontal: 4 },
  sheetBody: { padding: 20, paddingBottom: 32 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 8 },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#d4d4d8",
    backgroundColor: "#fff",
  },
  chipActive: { borderColor: "#10b981", backgroundColor: "#ecfdf5" },
  chipText: { fontSize: 12, color: "#3f3f46" },
  chipTextActive: { color: "#065f46", fontWeight: "600" },
});
