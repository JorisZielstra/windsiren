import { useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import {
  addHomeSpot,
  removeHomeSpot,
  SUGGESTED_HOME_SPOT_MAX,
} from "@windsiren/core";
import type { Spot } from "@windsiren/shared";
import { useAuth } from "../lib/auth-context";
import { supabase } from "../lib/supabase";

export type DashboardScope = "personalized" | "all";

// Mobile twin of the web HomeSpotsManager: one tappable trigger that
// opens a bottom sheet with two controls — scope toggle and inline
// home-spot management. Mutations call addHomeSpot / removeHomeSpot,
// then bubble up via onMutated so the caller can refresh its data.
export function HomeSpotsManager({
  homeSpotIds,
  allSpots,
  scope,
  onScopeChange,
  onMutated,
}: {
  homeSpotIds: Set<string>;
  allSpots: Spot[];
  scope: DashboardScope;
  onScopeChange: (next: DashboardScope) => void;
  onMutated: () => void;
}) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const homeSpots = allSpots.filter((s) => homeSpotIds.has(s.id));
  const nonHomeSpots = allSpots.filter((s) => !homeSpotIds.has(s.id));
  const triggerLabel =
    scope === "personalized" && homeSpotIds.size > 0
      ? `Personalized · ${homeSpotIds.size} home spot${homeSpotIds.size === 1 ? "" : "s"}`
      : "All NL spots";

  async function toggleHome(spotId: string, isHome: boolean) {
    if (!user) {
      setError("Sign in to manage home spots.");
      return;
    }
    setBusyId(spotId);
    setError(null);
    const result = isHome
      ? await removeHomeSpot(supabase, user.id, spotId)
      : await addHomeSpot(supabase, user.id, spotId);
    setBusyId(null);
    if (!result.ok) {
      setError(`Couldn't update: ${result.message}`);
      return;
    }
    onMutated();
  }

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        hitSlop={6}
      >
        <Text style={styles.trigger}>
          {triggerLabel}{" "}
          <Text style={styles.chevron}>▾</Text>
        </Text>
      </Pressable>

      <Modal
        visible={open}
        animationType="slide"
        transparent
        onRequestClose={() => setOpen(false)}
      >
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            <View style={styles.sheetHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.sheetLabel}>Dashboard scope</Text>
                <Text style={styles.sheetTitle}>Home spots & filter</Text>
              </View>
              <Pressable onPress={() => setOpen(false)} hitSlop={12}>
                <Text style={styles.closeBtn}>×</Text>
              </Pressable>
            </View>

            <ScrollView contentContainerStyle={styles.body}>
              <Text style={styles.sectionLabel}>Show on dashboard</Text>
              <View style={styles.pillRow}>
                <ScopePill
                  label="Home spots only"
                  active={scope === "personalized" && homeSpotIds.size > 0}
                  disabled={homeSpotIds.size === 0}
                  onPress={() => onScopeChange("personalized")}
                />
                <ScopePill
                  label="All NL"
                  active={scope === "all" || homeSpotIds.size === 0}
                  onPress={() => onScopeChange("all")}
                />
              </View>
              {homeSpotIds.size === 0 ? (
                <Text style={styles.helper}>
                  Add a home spot below to enable the personalized view.
                </Text>
              ) : null}

              {homeSpots.length > 0 ? (
                <>
                  <Text style={[styles.sectionLabel, { marginTop: 18 }]}>
                    Your home spots
                  </Text>
                  <View style={{ gap: 6, marginTop: 6 }}>
                    {homeSpots.map((spot) => (
                      <View key={spot.id} style={styles.homeRow}>
                        <Text style={styles.homeRowName}>🏠 {spot.name}</Text>
                        <Pressable
                          onPress={() => toggleHome(spot.id, true)}
                          disabled={busyId === spot.id}
                          hitSlop={8}
                        >
                          <Text
                            style={[
                              styles.removeBtn,
                              busyId === spot.id && { opacity: 0.5 },
                            ]}
                          >
                            {busyId === spot.id ? "…" : "×"}
                          </Text>
                        </Pressable>
                      </View>
                    ))}
                  </View>
                </>
              ) : null}

              <Text style={[styles.sectionLabel, { marginTop: 18 }]}>
                Add home spot
              </Text>
              {nonHomeSpots.length === 0 ? (
                <Text style={styles.helper}>All spots already pinned.</Text>
              ) : (
                <View style={{ gap: 6, marginTop: 6 }}>
                  {homeSpotIds.size >= SUGGESTED_HOME_SPOT_MAX ? (
                    <Text style={styles.helper}>
                      {homeSpotIds.size} chosen — we suggest ≤{" "}
                      {SUGGESTED_HOME_SPOT_MAX}. You can still add more.
                    </Text>
                  ) : null}
                  {nonHomeSpots.map((spot) => (
                    <Pressable
                      key={spot.id}
                      onPress={() => toggleHome(spot.id, false)}
                      disabled={busyId === spot.id}
                      style={({ pressed }) => [
                        styles.addRow,
                        pressed && { opacity: 0.6 },
                      ]}
                    >
                      <Text style={styles.addRowName}>{spot.name}</Text>
                      <Text style={styles.addRowHint}>
                        {busyId === spot.id ? "…" : "+"}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              )}

              {error ? <Text style={styles.error}>{error}</Text> : null}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

function ScopePill({
  label,
  active,
  disabled,
  onPress,
}: {
  label: string;
  active: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.pill,
        active && styles.pillActive,
        disabled && { opacity: 0.4 },
        pressed && { opacity: 0.6 },
      ]}
    >
      <Text style={[styles.pillText, active && styles.pillTextActive]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  trigger: { fontSize: 11, color: "#71717a" },
  chevron: { color: "#a1a1aa" },
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
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
  body: { padding: 20, paddingBottom: 40 },
  sectionLabel: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.6,
    color: "#71717a",
    textTransform: "uppercase",
  },
  pillRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 6 },
  pill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#d4d4d8",
    backgroundColor: "#fff",
  },
  pillActive: { borderColor: "#10b981", backgroundColor: "#ecfdf5" },
  pillText: { fontSize: 12, color: "#3f3f46" },
  pillTextActive: { color: "#065f46", fontWeight: "600" },
  helper: { marginTop: 6, fontSize: 11, color: "#71717a" },
  homeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#ecfdf5",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  homeRowName: { flex: 1, fontSize: 13, fontWeight: "500", color: "#064e3b" },
  removeBtn: {
    fontSize: 18,
    fontWeight: "600",
    color: "#71717a",
    paddingHorizontal: 6,
  },
  addRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderColor: "#e4e4e7",
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  addRowName: { flex: 1, fontSize: 13, color: "#18181b" },
  addRowHint: { fontSize: 16, color: "#10b981", fontWeight: "700" },
  error: {
    marginTop: 12,
    fontSize: 12,
    color: "#dc2626",
  },
});
