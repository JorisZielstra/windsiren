import { router } from "expo-router";
import { useEffect, useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { createRsvp, dbRowToSpot } from "@windsiren/core";
import type { Spot } from "@windsiren/shared";
import { useAuth } from "../lib/auth-context";
import { supabase } from "../lib/supabase";

type RsvpWindow = number | "all";

const WINDOW_HOURS: number[] = [6, 8, 10, 12, 14, 16, 18];

// Mobile twin of the web StartSessionFab. Renders a circular floating
// button bottom-right; one tap shows a popover with two paths:
//   - Plan a session → opens PlanSessionModal (3-step quick RSVP)
//   - Log past session → routes to /spots so the user can drill into a
//     spot and use the existing log composer there.
export function StartSessionFab() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [planOpen, setPlanOpen] = useState(false);

  if (!user) return null;

  return (
    <>
      <View pointerEvents="box-none" style={styles.fabWrap}>
        {open ? (
          <View style={styles.actions}>
            <Pressable
              style={[styles.actionBtn, styles.actionBtnHero]}
              onPress={() => {
                setOpen(false);
                router.push("/session-active");
              }}
            >
              <Text style={styles.actionTextHero}>🚀 Start session now</Text>
            </Pressable>
            <Pressable
              style={styles.actionBtn}
              onPress={() => {
                setOpen(false);
                setPlanOpen(true);
              }}
            >
              <Text style={styles.actionText}>📅 Plan a session</Text>
            </Pressable>
            <Pressable
              style={styles.actionBtn}
              onPress={() => {
                setOpen(false);
                router.push("/(tabs)/spots");
              }}
            >
              <Text style={styles.actionText}>✏️ Log past session</Text>
            </Pressable>
          </View>
        ) : null}
        <Pressable
          accessibilityLabel={open ? "Close start menu" : "Start a session"}
          onPress={() => setOpen((o) => !o)}
          style={({ pressed }) => [styles.fab, pressed && { opacity: 0.85 }]}
        >
          <Text style={styles.fabIcon}>{open ? "×" : "+"}</Text>
        </Pressable>
      </View>

      <Modal
        visible={planOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setPlanOpen(false)}
      >
        <PlanSessionModal onClose={() => setPlanOpen(false)} userId={user.id} />
      </Modal>
    </>
  );
}

function PlanSessionModal({
  onClose,
  userId,
}: {
  onClose: () => void;
  userId: string;
}) {
  const [spots, setSpots] = useState<Spot[] | null>(null);
  const [spotId, setSpotId] = useState<string | null>(null);
  const [dayOffset, setDayOffset] = useState<0 | 1 | 2>(0);
  const [window, setWindow] = useState<RsvpWindow>("all");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error: dbErr } = await supabase
        .from("spots")
        .select("*")
        .eq("active", true)
        .order("name");
      if (cancelled) return;
      if (dbErr) {
        setError(dbErr.message);
        return;
      }
      setSpots((data ?? []).map(dbRowToSpot));
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function submit() {
    if (!spotId) {
      setError("Pick a spot first.");
      return;
    }
    setBusy(true);
    setError(null);
    const dateKey = dateKeyForOffset(dayOffset);
    const result = await createRsvp(
      supabase,
      userId,
      spotId,
      dateKey,
      window === "all" ? null : window,
    );
    setBusy(false);
    if (!result.ok) {
      setError(result.reason === "error" ? result.message : "Couldn't plan session.");
      return;
    }
    const spot = spots?.find((s) => s.id === spotId);
    onClose();
    if (spot) router.push(`/spots/${spot.slug}`);
  }

  return (
    <Pressable style={styles.modalBackdrop} onPress={onClose}>
      <Pressable style={styles.sheet} onPress={() => {}}>
        <View style={styles.sheetHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.sheetLabel}>Plan a session</Text>
            <Text style={styles.sheetTitle}>Where & when?</Text>
          </View>
          <Pressable onPress={onClose} hitSlop={12}>
            <Text style={styles.closeBtn}>×</Text>
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={styles.sheetBody}>
          <Section label="1 · Spot">
            {spots === null ? (
              <Text style={styles.muted}>Loading spots…</Text>
            ) : (
              <View style={styles.chipRow}>
                {spots.map((s) => (
                  <Chip
                    key={s.id}
                    label={s.name}
                    active={spotId === s.id}
                    onPress={() => setSpotId(s.id)}
                  />
                ))}
              </View>
            )}
          </Section>

          <Section label="2 · Day">
            <View style={styles.chipRow}>
              {([0, 1, 2] as const).map((o) => (
                <Chip
                  key={o}
                  label={dayLabel(o)}
                  active={dayOffset === o}
                  onPress={() => setDayOffset(o)}
                />
              ))}
            </View>
          </Section>

          <Section label="3 · Time">
            <View style={styles.chipRow}>
              <Chip
                label="All day"
                active={window === "all"}
                onPress={() => setWindow("all")}
              />
              {WINDOW_HOURS.map((h) => (
                <Chip
                  key={h}
                  label={`${pad2(h)}–${pad2(h + 2)}`}
                  active={window === h}
                  onPress={() => setWindow(h)}
                />
              ))}
            </View>
          </Section>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <View style={styles.submitRow}>
            <Pressable onPress={onClose} hitSlop={8}>
              <Text style={styles.cancel}>Cancel</Text>
            </Pressable>
            <Pressable
              onPress={submit}
              disabled={busy || !spotId}
              style={({ pressed }) => [
                styles.submitBtn,
                (busy || !spotId) && { opacity: 0.5 },
                pressed && { opacity: 0.8 },
              ]}
            >
              <Text style={styles.submitText}>{busy ? "Saving…" : "Plan it"}</Text>
            </Pressable>
          </View>
        </ScrollView>
      </Pressable>
    </Pressable>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={{ marginTop: 16 }}>
      <Text style={styles.sectionLabel}>{label}</Text>
      {children}
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
        pressed && { opacity: 0.6 },
      ]}
    >
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </Pressable>
  );
}

function dateKeyForOffset(offset: 0 | 1 | 2): string {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
}

function dayLabel(offset: 0 | 1 | 2): string {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  if (offset === 0) return "Today";
  if (offset === 1) return "Tomorrow";
  return d.toLocaleDateString("en-NL", { weekday: "long" });
}

function pad2(n: number): string {
  return n.toString().padStart(2, "0");
}

const styles = StyleSheet.create({
  fabWrap: {
    position: "absolute",
    bottom: 24,
    right: 16,
    alignItems: "flex-end",
    gap: 10,
  },
  fab: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#059669",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  fabIcon: { color: "#fff", fontSize: 28, fontWeight: "700", lineHeight: 30 },
  actions: { gap: 8, alignItems: "flex-end" },
  actionBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e4e4e7",
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  actionText: { fontSize: 14, fontWeight: "600", color: "#18181b" },
  actionBtnHero: {
    backgroundColor: "#059669",
    borderColor: "#059669",
  },
  actionTextHero: { fontSize: 14, fontWeight: "700", color: "#fff" },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: "90%",
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
  sheetBody: { paddingHorizontal: 20, paddingBottom: 32 },
  sectionLabel: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.6,
    color: "#71717a",
    textTransform: "uppercase",
    marginBottom: 8,
  },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
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
  muted: { fontSize: 13, color: "#71717a" },
  error: { marginTop: 12, fontSize: 13, color: "#dc2626" },
  submitRow: {
    marginTop: 20,
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    gap: 16,
  },
  cancel: { fontSize: 13, color: "#71717a" },
  submitBtn: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: "#059669",
  },
  submitText: { color: "#fff", fontSize: 14, fontWeight: "600" },
});
