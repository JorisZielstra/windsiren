import { Link } from "expo-router";
import React from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Svg, {
  Circle,
  Line,
  Path,
  Rect,
  Text as SvgText,
} from "react-native-svg";
import {
  averageDirectionDeg,
  type FriendsOnWaterToday,
  type PublicProfile,
  type SpotWeek,
  type SpotWithVerdict,
} from "@windsiren/core";
import {
  cardinalDirection,
  DEFAULT_THRESHOLDS,
  isHourRideable,
  msToKnots,
  type HourlyForecast,
  type Spot,
} from "@windsiren/shared";
import { DirectionNeedle } from "./DirectionNeedle";

export type TileKey =
  | "score"
  | "wind"
  | "airTemp"
  | "friends"
  | "peakWindow"
  | "trend";

type Props = {
  tile: TileKey | null;
  onClose: () => void;
  dayItems: SpotWithVerdict[];
  bestSpot: SpotWithVerdict | null;
  spotWeeks: SpotWeek[];
  selectedDate: string;
  friends: FriendsOnWaterToday;
};

export function TileModal({
  tile,
  onClose,
  dayItems,
  bestSpot,
  spotWeeks,
  selectedDate,
  friends,
}: Props) {
  return (
    <Modal
      visible={tile !== null}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <Text style={styles.headerLabel}>
                {tile ? labelForTile(tile) : ""}
              </Text>
              <Text style={styles.headerTitle}>
                {tile ? titleForTile(tile, bestSpot) : ""}
              </Text>
            </View>
            <Pressable onPress={onClose} hitSlop={12}>
              <Text style={styles.closeBtn}>×</Text>
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={styles.body}>
            {tile === "score" ? (
              <ScoreChart
                dayItems={dayItems}
                spotWeeks={spotWeeks}
                selectedDate={selectedDate}
              />
            ) : tile === "wind" ? (
              <WindPolarChart bestSpot={bestSpot} />
            ) : tile === "airTemp" ? (
              <HourlyLineChart
                hours={bestSpot?.hours ?? []}
                valueOf={(h) => h.airTempC}
                unit="°C"
                thresholdMin={DEFAULT_THRESHOLDS.airTempMinC}
                accent="#f97316"
              />
            ) : tile === "peakWindow" ? (
              <HourlyLineChart
                hours={bestSpot?.hours ?? []}
                valueOf={(h) => msToKnots(h.windSpeedMs)}
                gustOf={(h) => msToKnots(h.gustMs)}
                unit="kn"
                spot={bestSpot?.spot}
                shadeRideable
                accent="#10b981"
              />
            ) : tile === "trend" ? (
              <HourlyLineChart
                hours={bestSpot?.hours ?? []}
                valueOf={(h) => msToKnots(h.windSpeedMs)}
                unit="kn"
                spot={bestSpot?.spot}
                showHalfAverages
                accent="#10b981"
              />
            ) : tile === "friends" ? (
              <FriendsTimeline friends={friends} onClose={onClose} />
            ) : null}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Score chart — bars per spot + week sparkline
// ---------------------------------------------------------------------------

function ScoreChart({
  dayItems,
  spotWeeks,
  selectedDate,
}: {
  dayItems: SpotWithVerdict[];
  spotWeeks: SpotWeek[];
  selectedDate: string;
}) {
  const sorted = [...dayItems].sort(
    (a, b) => countRideable(b) - countRideable(a),
  );
  const max = Math.max(1, ...sorted.map((s) => countRideable(s)));

  const weekScores = collectDateKeys(spotWeeks).map((dateKey) => {
    let goCount = 0;
    let total = 0;
    for (const w of spotWeeks) {
      const day = w.days.find((d) => d.dateKey === dateKey);
      if (!day) continue;
      total += 1;
      if (day.verdict?.decision === "go") goCount += 1;
    }
    return { dateKey, score: total > 0 ? Math.round((goCount / total) * 100) : 0 };
  });

  return (
    <View style={{ gap: 24 }}>
      <View>
        <Text style={styles.sectionLabel}>Spots by rideable hours</Text>
        <View style={{ marginTop: 8, gap: 6 }}>
          {sorted.map((item) => {
            const rideable = countRideable(item);
            const pct = (rideable / max) * 100;
            const color = colorForVerdict(item.verdict?.decision);
            return (
              <View key={item.spot.id} style={styles.barRow}>
                <Text style={styles.barName} numberOfLines={1}>
                  {item.spot.name}
                </Text>
                <View style={styles.barTrack}>
                  <View
                    style={[
                      styles.barFill,
                      { width: `${pct}%`, backgroundColor: color },
                    ]}
                  />
                </View>
                <Text style={styles.barValue}>{rideable}h</Text>
              </View>
            );
          })}
        </View>
      </View>

      <View>
        <Text style={styles.sectionLabel}>Score across the week</Text>
        <WeekScoreSpark scores={weekScores} highlight={selectedDate} />
      </View>
    </View>
  );
}

function WeekScoreSpark({
  scores,
  highlight,
}: {
  scores: { dateKey: string; score: number }[];
  highlight: string;
}) {
  const w = 320;
  const h = 90;
  const padX = 22;
  const padY = 18;
  const innerW = w - padX * 2;
  const innerH = h - padY * 2;
  const stepX = scores.length > 1 ? innerW / (scores.length - 1) : 0;
  const points = scores.map((s, i) => ({
    x: padX + i * stepX,
    y: padY + innerH * (1 - s.score / 100),
    s,
  }));
  const path = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`)
    .join(" ");
  return (
    <View style={{ marginTop: 8 }}>
      <Svg viewBox={`0 0 ${w} ${h}`} width="100%" height={h}>
        <Line
          x1={padX}
          y1={padY + innerH / 2}
          x2={w - padX}
          y2={padY + innerH / 2}
          stroke="#e4e4e7"
          strokeDasharray="2 3"
        />
        <Path d={path} stroke="#10b981" fill="none" strokeWidth={2} />
        {points.map((p) => (
          <Circle
            key={`c-${p.s.dateKey}`}
            cx={p.x}
            cy={p.y}
            r={p.s.dateKey === highlight ? 5 : 3}
            fill={p.s.dateKey === highlight ? "#10b981" : "#6ee7b7"}
          />
        ))}
        {points.map((p) => (
          <SvgText
            key={`d-${p.s.dateKey}`}
            x={p.x}
            y={h - 4}
            textAnchor="middle"
            fontSize={9}
            fill="#71717a"
          >
            {weekdayShort(p.s.dateKey)}
          </SvgText>
        ))}
        {points.map((p) => (
          <SvgText
            key={`s-${p.s.dateKey}`}
            x={p.x}
            y={p.y - 8}
            textAnchor="middle"
            fontSize={10}
            fill="#3f3f46"
          >
            {String(p.s.score)}
          </SvgText>
        ))}
      </Svg>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Wind polar chart — needle + hourly list
// ---------------------------------------------------------------------------

function WindPolarChart({ bestSpot }: { bestSpot: SpotWithVerdict | null }) {
  if (!bestSpot) return <NoData />;
  const daylight = daylightHoursOf(bestSpot.hours);
  if (daylight.length === 0) return <NoData />;
  const avg = averageDirectionDeg(daylight.map((h) => h.windDirectionDeg));

  return (
    <View style={{ gap: 16 }}>
      <View style={{ alignItems: "center" }}>
        <DirectionNeedle directionDeg={avg} size={140} />
        <Text style={styles.windAvgLabel}>{cardinalDirection(avg)}</Text>
        <Text style={styles.windAvgSub}>{Math.round(avg)}° avg</Text>
      </View>
      <View>
        <Text style={styles.sectionLabel}>Hourly direction</Text>
        <View style={{ marginTop: 8, gap: 4 }}>
          {daylight.map((h) => {
            const localHour = nlLocalHour(new Date(h.time));
            const knots = Math.round(msToKnots(h.windSpeedMs));
            return (
              <View key={h.time} style={styles.hourlyRow}>
                <Text style={styles.hourlyTime}>{pad2(localHour)}:00</Text>
                <Text style={styles.hourlyDir}>
                  {cardinalDirection(h.windDirectionDeg)}{" "}
                  <Text style={styles.hourlyDeg}>
                    {Math.round(h.windDirectionDeg)}°
                  </Text>
                </Text>
                <Text style={styles.hourlyKn}>{knots}kn</Text>
              </View>
            );
          })}
        </View>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Hourly line chart
// ---------------------------------------------------------------------------

function HourlyLineChart({
  hours,
  valueOf,
  gustOf,
  unit,
  spot,
  thresholdMin,
  shadeRideable = false,
  showHalfAverages = false,
  accent,
}: {
  hours: HourlyForecast[];
  valueOf: (h: HourlyForecast) => number;
  gustOf?: (h: HourlyForecast) => number;
  unit: string;
  spot?: Spot;
  thresholdMin?: number;
  shadeRideable?: boolean;
  showHalfAverages?: boolean;
  accent: string;
}) {
  const daylight = daylightHoursOf(hours);
  if (daylight.length === 0) return <NoData />;

  const w = 320;
  const h = 200;
  const padL = 32;
  const padR = 8;
  const padT = 12;
  const padB = 28;
  const innerW = w - padL - padR;
  const innerH = h - padT - padB;

  const values = daylight.map(valueOf);
  const gusts = gustOf ? daylight.map(gustOf) : null;
  const minSrc = gusts ?? values;
  const maxSrc = gusts ?? values;
  const yMin = Math.min(...values, ...(minSrc.length ? minSrc : [0]));
  const yMax = Math.max(...values, ...(maxSrc.length ? maxSrc : [0]));
  const yLo = Math.floor(yMin - (yMax - yMin) * 0.1);
  const yHi = Math.ceil(yMax + (yMax - yMin) * 0.1);
  const yRange = Math.max(1, yHi - yLo);
  const stepX = daylight.length > 1 ? innerW / (daylight.length - 1) : 0;

  const xy = (i: number, v: number) => ({
    x: padL + i * stepX,
    y: padT + innerH * (1 - (v - yLo) / yRange),
  });

  const linePath = values
    .map((v, i) => {
      const { x, y } = xy(i, v);
      return `${i === 0 ? "M" : "L"} ${x} ${y}`;
    })
    .join(" ");
  const gustPath = gusts
    ? gusts
        .map((v, i) => {
          const { x, y } = xy(i, v);
          return `${i === 0 ? "M" : "L"} ${x} ${y}`;
        })
        .join(" ")
    : null;
  const halfAvgs = showHalfAverages ? computeHalfAvgs(values) : null;
  const rideableMask =
    shadeRideable && spot
      ? daylight.map((h) => isHourRideable(h, spot, DEFAULT_THRESHOLDS))
      : null;

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
              <SvgText
                x={padL - 4}
                y={y + 3}
                textAnchor="end"
                fontSize={9}
                fill="#a1a1aa"
              >
                {`${v}${unit}`}
              </SvgText>
            </React.Fragment>
          );
        })}

        {thresholdMin !== undefined ? (
          <Line
            x1={padL}
            y1={padT + innerH * (1 - (thresholdMin - yLo) / yRange)}
            x2={w - padR}
            y2={padT + innerH * (1 - (thresholdMin - yLo) / yRange)}
            stroke="#a1a1aa"
            strokeDasharray="4 3"
          />
        ) : null}

        {rideableMask
          ? rideableMask.map((rideable, i) => {
              if (!rideable) return null;
              const x0 = Math.max(padL, padL + (i - 0.5) * stepX);
              const x1 = Math.min(w - padR, padL + (i + 0.5) * stepX);
              return (
                <Rect
                  key={`r-${i}`}
                  x={x0}
                  y={padT}
                  width={x1 - x0}
                  height={innerH}
                  fill="#d1fae5"
                  fillOpacity={0.6}
                />
              );
            })
          : null}

        {halfAvgs ? (
          <>
            <Line
              x1={padL}
              y1={padT + innerH * (1 - (halfAvgs.first - yLo) / yRange)}
              x2={padL + innerW / 2}
              y2={padT + innerH * (1 - (halfAvgs.first - yLo) / yRange)}
              stroke="#a1a1aa"
              strokeWidth={1.5}
              strokeDasharray="6 3"
            />
            <Line
              x1={padL + innerW / 2}
              y1={padT + innerH * (1 - (halfAvgs.second - yLo) / yRange)}
              x2={w - padR}
              y2={padT + innerH * (1 - (halfAvgs.second - yLo) / yRange)}
              stroke="#a1a1aa"
              strokeWidth={1.5}
              strokeDasharray="6 3"
            />
          </>
        ) : null}

        {gustPath ? (
          <Path d={gustPath} fill="none" stroke={accent} strokeOpacity={0.35} strokeWidth={2} />
        ) : null}

        <Path d={linePath} fill="none" stroke={accent} strokeWidth={2.5} strokeLinejoin="round" />

        {values.map((v, i) => {
          const { x, y } = xy(i, v);
          return <Circle key={`p-${i}`} cx={x} cy={y} r={2.5} fill={accent} />;
        })}

        {daylight.map((h, i) => {
          const localHour = nlLocalHour(new Date(h.time));
          if (i !== 0 && i !== daylight.length - 1 && localHour % 3 !== 0) return null;
          return (
            <SvgText
              key={`x-${h.time}`}
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

      <View style={styles.legendRow}>
        <LegendDot color={accent} label={gustPath ? "wind" : "value"} />
        {gustPath ? (
          <LegendDot color={accent} label="gust" opacity={0.35} />
        ) : null}
        {shadeRideable ? <LegendBar label="rideable" /> : null}
        {thresholdMin !== undefined ? (
          <Text style={styles.legendText}>
            min {thresholdMin}
            {unit}
          </Text>
        ) : null}
        {halfAvgs ? (
          <Text style={styles.legendText}>
            avg {halfAvgs.first.toFixed(1)} → {halfAvgs.second.toFixed(1)} {unit}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

function LegendDot({
  color,
  label,
  opacity = 1,
}: {
  color: string;
  label: string;
  opacity?: number;
}) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendSwatch, { backgroundColor: color, opacity }]} />
      <Text style={styles.legendText}>{label}</Text>
    </View>
  );
}

function LegendBar({ label }: { label: string }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendSwatch, { backgroundColor: "#d1fae5", height: 8 }]} />
      <Text style={styles.legendText}>{label}</Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Friends list
// ---------------------------------------------------------------------------

function FriendsTimeline({
  friends,
  onClose,
}: {
  friends: FriendsOnWaterToday;
  onClose: () => void;
}) {
  if (friends.profiles.length === 0) {
    return (
      <Text style={{ fontSize: 14, color: "#71717a" }}>
        Nobody you follow has logged a session or RSVP'd today.
      </Text>
    );
  }
  return (
    <View style={{ gap: 8 }}>
      {friends.profiles.map((p: PublicProfile) => (
        <Link key={p.id} href={`/users/${p.id}`} asChild>
          <Pressable style={styles.friendRow} onPress={onClose}>
            <Text style={styles.friendName}>{p.display_name ?? "Someone"}</Text>
            <Text style={styles.friendOut}>out today</Text>
          </Pressable>
        </Link>
      ))}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function NoData() {
  return <Text style={{ fontSize: 14, color: "#71717a" }}>No data for this date.</Text>;
}

function colorForVerdict(d: "go" | "marginal" | "no_go" | undefined): string {
  if (d === "go") return "#10b981";
  if (d === "marginal") return "#f59e0b";
  return "#a1a1aa";
}

function labelForTile(tile: TileKey): string {
  return {
    score: "Conditions score",
    wind: "Wind",
    airTemp: "Air temperature",
    friends: "Friends on the water",
    peakWindow: "Peak window",
    trend: "Wind trend",
  }[tile];
}

function titleForTile(tile: TileKey, bestSpot: SpotWithVerdict | null): string {
  if (tile === "score") return "Score breakdown";
  const at = bestSpot ? ` · ${bestSpot.spot.name}` : "";
  if (tile === "wind") return `Hourly direction${at}`;
  if (tile === "airTemp") return `Hourly temperature${at}`;
  if (tile === "peakWindow") return `Hourly wind${at}`;
  if (tile === "trend") return `Wind trend${at}`;
  return "Today's friends";
}

function countRideable(item: SpotWithVerdict): number {
  return item.hours.filter((h) =>
    isHourRideable(h, item.spot, DEFAULT_THRESHOLDS),
  ).length;
}

function daylightHoursOf(hours: HourlyForecast[]): HourlyForecast[] {
  return hours.filter((h) => {
    const localHour = nlLocalHour(new Date(h.time));
    return localHour >= 8 && localHour <= 20;
  });
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

function weekdayShort(dateKey: string): string {
  const d = new Date(`${dateKey}T12:00:00Z`);
  return d.toLocaleDateString("en-NL", {
    weekday: "short",
    timeZone: "Europe/Amsterdam",
  });
}

function collectDateKeys(spotWeeks: SpotWeek[]): string[] {
  const keys = new Set<string>();
  for (const w of spotWeeks) for (const d of w.days) keys.add(d.dateKey);
  return Array.from(keys).sort();
}

function computeHalfAvgs(values: number[]): { first: number; second: number } {
  const mid = Math.floor(values.length / 2);
  const first = values.slice(0, mid);
  const second = values.slice(mid);
  return {
    first: first.reduce((s, x) => s + x, 0) / Math.max(1, first.length),
    second: second.reduce((s, x) => s + x, 0) / Math.max(1, second.length),
  };
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
  },
  headerTitle: { fontSize: 17, fontWeight: "600", color: "#18181b", marginTop: 2 },
  closeBtn: { fontSize: 28, lineHeight: 28, color: "#a1a1aa", paddingHorizontal: 4 },
  body: { padding: 20, paddingBottom: 32 },
  sectionLabel: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.6,
    color: "#71717a",
  },
  barRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  barName: { width: 110, fontSize: 13, color: "#18181b" },
  barTrack: {
    flex: 1,
    height: 18,
    backgroundColor: "#f4f4f5",
    borderRadius: 4,
    overflow: "hidden",
  },
  barFill: { height: "100%" },
  barValue: {
    width: 36,
    textAlign: "right",
    fontSize: 11,
    color: "#71717a",
    fontVariant: ["tabular-nums"],
  },
  windAvgLabel: {
    marginTop: 8,
    fontSize: 24,
    fontWeight: "700",
    color: "#18181b",
    fontVariant: ["tabular-nums"],
  },
  windAvgSub: { fontSize: 11, color: "#71717a", marginTop: 2 },
  hourlyRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" },
  hourlyTime: { fontSize: 11, color: "#71717a", fontVariant: ["tabular-nums"], width: 50 },
  hourlyDir: { fontSize: 13, color: "#18181b", fontWeight: "500", flex: 1 },
  hourlyDeg: { fontSize: 11, color: "#71717a" },
  hourlyKn: { fontSize: 11, color: "#71717a", fontVariant: ["tabular-nums"], width: 36, textAlign: "right" },
  legendRow: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginTop: 8 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  legendSwatch: { width: 12, height: 2 },
  legendText: { fontSize: 11, color: "#71717a" },
  friendRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderColor: "#e4e4e7",
    borderWidth: 1,
    borderRadius: 8,
  },
  friendName: { fontSize: 14, fontWeight: "600", color: "#18181b" },
  friendOut: { fontSize: 11, color: "#71717a" },
});
