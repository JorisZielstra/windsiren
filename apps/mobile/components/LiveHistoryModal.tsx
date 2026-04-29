import React, { useEffect, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import Svg, { Circle, Line, Path, Text as SvgText } from "react-native-svg";
import { fetchPastHours } from "@windsiren/core";
import {
  cardinalDirection,
  msToKnots,
  windKnColor,
  type HourlyForecast,
  type Spot,
} from "@windsiren/shared";

// Mobile twin of the web LiveHistoryModal. Shown when the user taps the
// "Past 24h" pill in the Live collapsible's right accessory.
export function LiveHistoryModal({
  spot,
  visible,
  onClose,
  hoursBack = 24,
}: {
  spot: Pick<Spot, "lat" | "lng" | "name">;
  visible: boolean;
  onClose: () => void;
  hoursBack?: number;
}) {
  const [hours, setHours] = useState<HourlyForecast[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    setError(null);
    setHours(null);
    fetchPastHours(spot, hoursBack)
      .then((h) => {
        if (!cancelled) setHours(h);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      });
    return () => {
      cancelled = true;
    };
  }, [visible, spot, hoursBack]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <Text style={styles.headerLabel}>{`Past ${hoursBack}h`}</Text>
              <Text style={styles.headerTitle}>Actual wind · {spot.name}</Text>
            </View>
            <Pressable onPress={onClose} hitSlop={12}>
              <Text style={styles.closeBtn}>×</Text>
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.body}>
            {error ? (
              <Text style={styles.muted}>Couldn't load history: {error}</Text>
            ) : hours === null ? (
              <Text style={styles.muted}>{`Loading past ${hoursBack}h…`}</Text>
            ) : hours.length === 0 ? (
              <Text style={styles.muted}>No recent observations.</Text>
            ) : (
              <HistoryChart hours={hours} />
            )}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function HistoryChart({ hours }: { hours: HourlyForecast[] }) {
  const w = 320;
  const h = 200;
  const padL = 32;
  const padR = 8;
  const padT = 12;
  const padB = 28;
  const innerW = w - padL - padR;
  const innerH = h - padT - padB;

  const winds = hours.map((x) => msToKnots(x.windSpeedMs));
  const gusts = hours.map((x) => msToKnots(x.gustMs));
  const yMax = Math.max(1, ...gusts);
  const yLo = 0;
  const yHi = Math.ceil(yMax * 1.1);
  const yRange = Math.max(1, yHi - yLo);
  const stepX = hours.length > 1 ? innerW / (hours.length - 1) : 0;

  const xy = (i: number, v: number) => ({
    x: padL + i * stepX,
    y: padT + innerH * (1 - (v - yLo) / yRange),
  });

  const windPath = winds
    .map((v, i) => {
      const { x, y } = xy(i, v);
      return `${i === 0 ? "M" : "L"} ${x} ${y}`;
    })
    .join(" ");
  const gustPath = gusts
    .map((v, i) => {
      const { x, y } = xy(i, v);
      return `${i === 0 ? "M" : "L"} ${x} ${y}`;
    })
    .join(" ");

  const last = hours[hours.length - 1]!;
  const lastKn = msToKnots(last.windSpeedMs);
  const lastTint = windKnColor(lastKn);

  return (
    <View>
      <Svg viewBox={`0 0 ${w} ${h}`} width="100%" height={h + 20}>
        {[0, 0.5, 1].map((t) => {
          const y = padT + innerH * t;
          const v = Math.round(yHi - yRange * t);
          return (
            <React.Fragment key={t}>
              <Line
                x1={padL}
                y1={y}
                x2={w - padR}
                y2={y}
                stroke="#e4e4e7"
                strokeDasharray="2 3"
              />
              <SvgText x={padL - 4} y={y + 3} textAnchor="end" fontSize={9} fill="#a1a1aa">
                {`${v}kn`}
              </SvgText>
            </React.Fragment>
          );
        })}
        <Path d={gustPath} fill="none" stroke="#10b981" strokeOpacity={0.35} strokeWidth={2} />
        <Path d={windPath} fill="none" stroke="#10b981" strokeWidth={2.5} />
        {winds.map((v, i) => {
          const { x, y } = xy(i, v);
          return <Circle key={`p-${i}`} cx={x} cy={y} r={2} fill="#10b981" />;
        })}
        {hours.map((entry, i) => {
          const localHour = nlLocalHour(new Date(entry.time));
          if (i !== 0 && i !== hours.length - 1 && localHour % 3 !== 0) return null;
          return (
            <SvgText
              key={`x-${entry.time}`}
              x={padL + i * stepX}
              y={padT + innerH + 14}
              textAnchor="middle"
              fontSize={9}
              fill="#71717a"
            >
              {`${pad2(localHour)}h`}
            </SvgText>
          );
        })}
      </Svg>
      <View style={styles.legend}>
        <Text style={styles.legendText}>wind / gust</Text>
        <Text
          style={[
            styles.legendChip,
            { backgroundColor: lastTint.bg, color: lastTint.fg },
          ]}
        >
          Latest {Math.round(lastKn)} kn {cardinalDirection(last.windDirectionDeg)}
        </Text>
      </View>
    </View>
  );
}

function nlLocalHour(d: Date): number {
  const hh = new Intl.DateTimeFormat("en-NL", {
    timeZone: "Europe/Amsterdam",
    hour: "2-digit",
    hour12: false,
  }).format(d);
  return parseInt(hh, 10);
}

function pad2(n: number): string {
  return n.toString().padStart(2, "0");
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: "90%",
    paddingBottom: 24,
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 14,
    borderBottomColor: "#f4f4f5",
    borderBottomWidth: 1,
    gap: 12,
  },
  headerLabel: {
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 1.2,
    color: "#71717a",
    textTransform: "uppercase",
  },
  headerTitle: { fontSize: 17, fontWeight: "600", color: "#18181b", marginTop: 2 },
  closeBtn: { fontSize: 28, lineHeight: 28, color: "#a1a1aa", paddingHorizontal: 4 },
  body: { padding: 20 },
  muted: { fontSize: 14, color: "#71717a" },
  legend: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 12, marginTop: 8 },
  legendText: { fontSize: 11, color: "#71717a" },
  legendChip: {
    fontSize: 12,
    fontVariant: ["tabular-nums"],
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    overflow: "hidden",
  },
});
