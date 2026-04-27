import React from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import Svg, { Circle, Path, Text as SvgText } from "react-native-svg";
import { bucketHours, type HourBucket } from "@windsiren/core";
import {
  cardinalDirection,
  msToKnots,
  windKnColor,
  type HourlyForecast,
  type Spot,
  type TidePoint,
} from "@windsiren/shared";

type Props = {
  spot: Spot;
  hours: HourlyForecast[];
  windowSize?: number;
  tideEvents?: TidePoint[];
};

const COL_WIDTH = 60;
const ROW_HEIGHT = 36;
const HEADER_HEIGHT = 60; // fits "Mo 27/4" + "08:00 / – / 10:00"

// Windguru-style pivoted forecast for mobile. Single continuous table
// across all fetched days. The legend column on the left is fixed
// (rendered outside the horizontal ScrollView) so it stays visible
// while the user scrolls right through the week.
//
// Each column header repeats the day + date so mid-week scroll
// positions stay legible — important on phones where only ~5 columns
// fit on screen at once.
export function WindguruDayTable({
  spot,
  hours,
  windowSize = 2,
  tideEvents,
}: Props) {
  const buckets = bucketHours(hours, spot, windowSize);
  if (buckets.length === 0) {
    return <Text style={styles.empty}>No hourly data to show.</Text>;
  }

  const showTide = tideEvents && tideEvents.length > 1;

  return (
    <View style={styles.outer}>
      <View style={styles.legendCol}>
        <View style={[styles.legendCell, { height: HEADER_HEIGHT }]}>
          <Text style={styles.legendText}>Time</Text>
        </View>
        <LegendCell label="Wind kn" />
        <LegendCell label="Gust kn" />
        <LegendCell label="Dir" />
        <LegendCell label="Air °C" />
        <LegendCell label="Rain" />
        <LegendCell label="Ride" />
        {showTide ? (
          <View style={[styles.legendCell, { height: TIDE_ROW_HEIGHT }]}>
            <Text style={styles.legendText}>Tide</Text>
          </View>
        ) : null}
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View>
          <View style={{ flexDirection: "row" }}>
            {buckets.map((b, i) => {
              const dayBoundary =
                i > 0 && b.dateKey !== buckets[i - 1]!.dateKey;
              return (
                <BucketColumn
                  key={b.startTime}
                  bucket={b}
                  windowSize={windowSize}
                  dayBoundary={dayBoundary}
                />
              );
            })}
          </View>
          {showTide ? (
            <TideRow buckets={buckets} tideEvents={tideEvents!} />
          ) : null}
        </View>
      </ScrollView>
    </View>
  );
}

const TIDE_ROW_HEIGHT = 56;

function TideRow({
  buckets,
  tideEvents,
}: {
  buckets: HourBucket[];
  tideEvents: TidePoint[];
}) {
  const events = [...tideEvents].sort((a, b) =>
    a.at < b.at ? -1 : a.at > b.at ? 1 : 0,
  );
  if (events.length < 2) return null;

  const startTimeMs = new Date(buckets[0]!.startTime).getTime();
  const totalHours = buckets.length * 2;
  const totalMs = totalHours * 3600 * 1000;
  const totalWidth = buckets.length * COL_WIDTH;
  const padY = 6;
  const innerH = TIDE_ROW_HEIGHT - padY * 2;

  const samples: { x: number; height: number }[] = [];
  const SAMPLE_STEP_PX = 4;
  for (let x = 0; x <= totalWidth; x += SAMPLE_STEP_PX) {
    const t = startTimeMs + (x / totalWidth) * totalMs;
    samples.push({ x, height: tideHeightAt(events, t) });
  }
  const heights = samples.map((s) => s.height);
  const lo = Math.min(...heights);
  const hi = Math.max(...heights);
  const range = Math.max(1, hi - lo);
  const yOf = (h: number) => padY + innerH * (1 - (h - lo) / range);

  const linePath = samples
    .map(
      (s, i) =>
        `${i === 0 ? "M" : "L"} ${s.x.toFixed(1)} ${yOf(s.height).toFixed(1)}`,
    )
    .join(" ");
  const fillPath = `${linePath} L ${totalWidth} ${TIDE_ROW_HEIGHT} L 0 ${TIDE_ROW_HEIGHT} Z`;

  const visibleEvents = events.filter((e) => {
    const t = new Date(e.at).getTime();
    return t >= startTimeMs && t <= startTimeMs + totalMs;
  });

  return (
    <View
      style={{
        width: totalWidth,
        height: TIDE_ROW_HEIGHT,
        borderTopWidth: 1,
        borderTopColor: "#f4f4f5",
      }}
    >
      <Svg width={totalWidth} height={TIDE_ROW_HEIGHT}>
        <Path d={fillPath} fill="#e0f2fe" />
        <Path d={linePath} stroke="#0284c7" strokeWidth={1.5} fill="none" />
        {visibleEvents.map((e) => {
          const t = new Date(e.at).getTime();
          const x = ((t - startTimeMs) / totalMs) * totalWidth;
          const y = yOf(tideHeightAt(events, t));
          const labelY = e.type === "high" ? y - 4 : y + 12;
          return (
            <React.Fragment key={e.at}>
              <Circle cx={x} cy={y} r={2} fill="#0369a1" />
              <SvgText
                x={x}
                y={labelY}
                textAnchor="middle"
                fontSize={9}
                fill="#3f3f46"
              >
                {fmtNlClock(new Date(e.at))}
              </SvgText>
            </React.Fragment>
          );
        })}
      </Svg>
    </View>
  );
}

function tideHeightAt(events: TidePoint[], t: number): number {
  if (events.length === 0) return 0;
  const first = events[0]!;
  const last = events[events.length - 1]!;
  if (t <= new Date(first.at).getTime()) return first.heightCm;
  if (t >= new Date(last.at).getTime()) return last.heightCm;
  for (let i = 0; i < events.length - 1; i++) {
    const a = events[i]!;
    const b = events[i + 1]!;
    const aT = new Date(a.at).getTime();
    const bT = new Date(b.at).getTime();
    if (t >= aT && t <= bT) {
      const f = (t - aT) / (bT - aT);
      return a.heightCm + (b.heightCm - a.heightCm) * (1 - Math.cos(f * Math.PI)) / 2;
    }
  }
  return last.heightCm;
}

function fmtNlClock(d: Date): string {
  return new Intl.DateTimeFormat("en-NL", {
    timeZone: "Europe/Amsterdam",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(d);
}

function BucketColumn({
  bucket,
  windowSize,
  dayBoundary,
}: {
  bucket: HourBucket;
  windowSize: number;
  dayBoundary: boolean;
}) {
  const windKn = msToKnots(bucket.windSpeedMs);
  const gustKn = msToKnots(bucket.gustMs);
  const cardinal = cardinalDirection(bucket.windDirectionDeg);
  return (
    <View style={[styles.col, dayBoundary && styles.colDayBoundary]}>
      <CellHeader
        dateKey={bucket.dateKey}
        startHour={bucket.startLocalHour}
        endHour={(bucket.startLocalHour + windowSize) % 24}
      />
      <CellKn kn={windKn} bold />
      <CellKn kn={gustKn} />
      <CellDirection deg={bucket.windDirectionDeg} cardinal={cardinal} />
      <CellNum value={Math.round(bucket.airTempC)} />
      <CellRain mm={bucket.precipitationMm} />
      <CellRide rideable={bucket.rideable} />
    </View>
  );
}

function LegendCell({ label }: { label: string }) {
  return (
    <View style={styles.legendCell}>
      <Text style={styles.legendText}>{label}</Text>
    </View>
  );
}

function CellHeader({
  dateKey,
  startHour,
  endHour,
}: {
  dateKey: string;
  startHour: number;
  endHour: number;
}) {
  return (
    <View style={[styles.headerCell, { height: HEADER_HEIGHT }]}>
      <Text style={styles.headerDay}>{formatDayHeader(dateKey)}</Text>
      <Text style={styles.headerTime}>{pad2(startHour)}:00</Text>
      <Text style={styles.headerDash}>–</Text>
      <Text style={styles.headerTime}>{pad2(endHour)}:00</Text>
    </View>
  );
}

function CellKn({ kn, bold = false }: { kn: number; bold?: boolean }) {
  const { bg, fg } = windKnColor(kn);
  return (
    <View style={[styles.cell, { backgroundColor: bg }]}>
      <Text style={[styles.cellWindText, bold && styles.cellWindBold, { color: fg }]}>
        {Math.round(kn)}
      </Text>
    </View>
  );
}

function CellNum({ value, muted = false }: { value: number; muted?: boolean }) {
  return (
    <View style={styles.cell}>
      <Text style={[styles.cellNumText, muted && styles.muted]}>{value}</Text>
    </View>
  );
}

function CellDirection({ deg, cardinal }: { deg: number; cardinal: string }) {
  return (
    <View style={[styles.cell, styles.cellDir]}>
      <Arrow degrees={deg} />
      <Text style={styles.cellCardinal}>{cardinal}</Text>
    </View>
  );
}

function CellRain({ mm }: { mm: number }) {
  if (mm <= 0) {
    return (
      <View style={styles.cell}>
        <Text style={styles.muted}>—</Text>
      </View>
    );
  }
  const isHeavy = mm > 0.5;
  return (
    <View style={[styles.cell, isHeavy && styles.cellRainHeavy]}>
      <Text style={[styles.cellNumText, isHeavy && styles.cellRainHeavyText]}>
        {mm.toFixed(1)}
      </Text>
    </View>
  );
}

function CellRide({ rideable }: { rideable: boolean }) {
  return (
    <View style={styles.cell}>
      <View
        style={[styles.rideDot, rideable ? styles.rideDotOn : styles.rideDotOff]}
      />
    </View>
  );
}

function Arrow({ degrees }: { degrees: number }) {
  const downwind = (degrees + 180) % 360;
  return (
    <View style={{ transform: [{ rotate: `${downwind}deg` }] }}>
      <Svg width={12} height={12} viewBox="0 0 12 12">
        <Path d="M6 1 L9.5 8 L6 6.5 L2.5 8 Z" fill="#3f3f46" />
      </Svg>
    </View>
  );
}

function pad2(n: number): string {
  return n.toString().padStart(2, "0");
}

const NL_WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

function formatDayHeader(dateKey: string): string {
  const d = new Date(`${dateKey}T12:00:00Z`);
  const localDate = new Date(
    d.toLocaleString("en-US", { timeZone: "Europe/Amsterdam" }),
  );
  const weekday = NL_WEEKDAYS[localDate.getDay()] ?? "";
  const day = parseInt(dateKey.slice(8, 10), 10);
  const month = parseInt(dateKey.slice(5, 7), 10);
  return `${weekday} ${day}/${month}`;
}

const styles = StyleSheet.create({
  outer: {
    flexDirection: "row",
    borderWidth: 1,
    borderColor: "#e4e4e7",
    borderRadius: 8,
    overflow: "hidden",
  },
  legendCol: {
    backgroundColor: "#fafafa",
    borderRightWidth: 1,
    borderRightColor: "#e4e4e7",
  },
  legendCell: {
    height: ROW_HEIGHT,
    justifyContent: "center",
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#f4f4f5",
  },
  legendText: {
    fontSize: 9,
    fontWeight: "600",
    letterSpacing: 0.5,
    color: "#71717a",
    textTransform: "uppercase",
  },
  col: {
    width: COL_WIDTH,
    borderLeftWidth: 1,
    borderLeftColor: "#f4f4f5",
  },
  // Slightly thicker accent on the column where a new day begins.
  colDayBoundary: { borderLeftWidth: 2, borderLeftColor: "#d4d4d8" },
  headerCell: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fafafa",
    borderBottomWidth: 1,
    borderBottomColor: "#e4e4e7",
    paddingVertical: 4,
  },
  headerDay: {
    fontSize: 10,
    fontWeight: "700",
    color: "#3f3f46",
    marginBottom: 2,
  },
  headerTime: {
    fontSize: 10,
    fontVariant: ["tabular-nums"],
    color: "#52525b",
    lineHeight: 12,
  },
  headerDash: { fontSize: 9, color: "#a1a1aa", lineHeight: 10 },
  cell: {
    height: ROW_HEIGHT,
    alignItems: "center",
    justifyContent: "center",
    borderBottomWidth: 1,
    borderBottomColor: "#f4f4f5",
  },
  cellWindText: {
    fontSize: 14,
    fontVariant: ["tabular-nums"],
  },
  cellWindBold: { fontWeight: "700" },
  cellNumText: {
    fontSize: 13,
    color: "#18181b",
    fontVariant: ["tabular-nums"],
  },
  muted: { color: "#a1a1aa" },
  cellDir: { gap: 1 },
  cellCardinal: { fontSize: 9, color: "#71717a", fontVariant: ["tabular-nums"] },
  cellRainHeavy: { backgroundColor: "#f0f9ff" },
  cellRainHeavyText: { color: "#0369a1" },
  rideDot: { width: 8, height: 8, borderRadius: 4 },
  rideDotOn: { backgroundColor: "#10b981" },
  rideDotOff: { backgroundColor: "#d4d4d8" },
  empty: { fontSize: 12, color: "#71717a", paddingVertical: 8 },
});
