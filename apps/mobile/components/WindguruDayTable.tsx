import { ScrollView, StyleSheet, Text, View } from "react-native";
import Svg, { Path } from "react-native-svg";
import { bucketHours, type HourBucket } from "@windsiren/core";
import {
  cardinalDirection,
  msToKnots,
  windKnColor,
  type HourlyForecast,
  type Spot,
} from "@windsiren/shared";

type Props = {
  spot: Spot;
  hours: HourlyForecast[];
  windowSize?: number;
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
export function WindguruDayTable({ spot, hours, windowSize = 2 }: Props) {
  const buckets = bucketHours(hours, spot, windowSize);
  if (buckets.length === 0) {
    return <Text style={styles.empty}>No hourly data to show.</Text>;
  }

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
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
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
      </ScrollView>
    </View>
  );
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
