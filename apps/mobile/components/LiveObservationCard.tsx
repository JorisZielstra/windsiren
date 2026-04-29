import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { cardinalDirection, msToKnots, type Spot } from "@windsiren/shared";
import type { LiveObservation } from "@windsiren/core";
import { LiveHistoryModal } from "./LiveHistoryModal";

// Mobile twin of apps/web/components/LiveObservationCard. The whole
// surface is pressable — tap anywhere on the live card to open the
// past-24h modal — and the explicit "Past 24h ↗" pill stays as a
// discoverable affordance for users who scan rather than experiment.
//
// React Native's gesture system means the inner Pressable consumes its
// own touch, so the outer Pressable doesn't double-fire. Both still
// call setOpen(true) so either path opens the modal.
export function LiveObservationCard({
  live,
  spot,
}: {
  live: LiveObservation;
  spot: Pick<Spot, "lat" | "lng" | "name">;
}) {
  const [open, setOpen] = useState(false);
  const stale = live.ageMinutes > 20;
  const o = live.observation;

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={`Show past 24 hours of wind at ${spot.name}`}
        style={({ pressed }) => [styles.card, pressed && styles.pressed]}
      >
        <View style={styles.header}>
          <View style={styles.headerText}>
            <Text style={styles.title}>
              Live — KNMI {o.stationId}
            </Text>
            <Text style={stale ? styles.ageStale : styles.age}>
              {live.ageMinutes === 0 ? "just now" : `${live.ageMinutes} min ago`}
              {stale ? " · stale" : ""}
              <Text style={styles.hint}>  · tap for past 24h</Text>
            </Text>
          </View>
          <Pressable
            onPress={() => setOpen(true)}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel="Show past 24 hours of wind"
            style={({ pressed }) => [styles.btn, pressed && styles.btnPressed]}
          >
            <Text style={styles.btnText}>Past 24h ↗</Text>
          </Pressable>
        </View>

        <View style={styles.stats}>
          <Stat
            label="Wind"
            value={`${msToKnots(o.windSpeedMs).toFixed(0)} kn`}
            sub={cardinalDirection(o.windDirectionDeg)}
          />
          <Stat label="Gust" value={`${msToKnots(o.gustMs).toFixed(0)} kn`} />
          <Stat label="Dir" value={`${Math.round(o.windDirectionDeg)}°`} />
          {o.airTempC !== null ? (
            <Stat label="Air" value={`${o.airTempC.toFixed(0)}°C`} />
          ) : null}
        </View>
      </Pressable>
      <LiveHistoryModal
        spot={spot}
        visible={open}
        onClose={() => setOpen(false)}
      />
    </>
  );
}

function Stat({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <View>
      <Text style={styles.statLabel}>{label}</Text>
      <View style={styles.statValueRow}>
        <Text style={styles.statValue}>{value}</Text>
        {sub ? <Text style={styles.statSub}>{sub}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    paddingTop: 14,
    paddingBottom: 14,
  },
  pressed: {
    backgroundColor: "#f3eee0",
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    gap: 12,
  },
  headerText: { flex: 1, minWidth: 0 },
  title: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1.6,
    textTransform: "uppercase",
    color: "#6c7d88",
  },
  age: { marginTop: 4, fontSize: 11, color: "#6c7d88" },
  ageStale: { marginTop: 4, fontSize: 11, color: "#d88b3d" },
  hint: { color: "#a7b2b9" },
  btn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#e8e2d2",
    backgroundColor: "#ffffff",
  },
  btnPressed: { opacity: 0.6 },
  btnText: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.6,
    color: "#324a59",
    textTransform: "uppercase",
  },
  stats: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 20,
    paddingHorizontal: 16,
    marginTop: 12,
  },
  statLabel: {
    fontSize: 10,
    color: "#6c7d88",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  statValueRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 4,
    marginTop: 2,
  },
  statValue: { fontSize: 20, fontWeight: "600", fontVariant: ["tabular-nums"] },
  statSub: { fontSize: 11, color: "#6c7d88" },
});
