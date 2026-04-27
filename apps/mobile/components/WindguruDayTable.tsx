import { ScrollView, StyleSheet, Text, View } from "react-native";
import Svg, { Path } from "react-native-svg";
import { bucketHours, type HourBucket } from "@windsiren/core";
import {
  cardinalDirection,
  msToKnots,
  type HourlyForecast,
  type Spot,
} from "@windsiren/shared";

type Props = {
  spot: Spot;
  hours: HourlyForecast[];
  windowSize?: number;
};

const COL_WIDTH = 44;
const ROW_HEIGHT = 36;

// Windguru-style pivoted table for mobile: rows are metrics (Time, Wind,
// Gust, Dir, Temp, Rain, Ride), columns are 2-hour windows of the day.
// Left legend column is fixed; right side is a horizontal ScrollView.
export function WindguruDayTable({ spot, hours, windowSize = 2 }: Props) {
  const buckets = bucketHours(hours, spot, windowSize);
  if (buckets.length === 0) {
    return <Text style={styles.empty}>No hourly data for this day.</Text>;
  }

  return (
    <View style={styles.outer}>
      <View style={styles.legendCol}>
        <LegendCell label="Time" />
        <LegendCell label="Wind kn" />
        <LegendCell label="Gust kn" />
        <LegendCell label="Dir" />
        <LegendCell label="Air °C" />
        <LegendCell label="Rain" />
        <LegendCell label="Ride" />
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={{ flexDirection: "row" }}>
          {buckets.map((b) => (
            <BucketColumn key={b.startTime} bucket={b} />
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

function BucketColumn({ bucket }: { bucket: HourBucket }) {
  const windKn = msToKnots(bucket.windSpeedMs);
  const gustKn = msToKnots(bucket.gustMs);
  const cardinal = cardinalDirection(bucket.windDirectionDeg);
  return (
    <View style={styles.col}>
      <CellTime hour={bucket.startLocalHour} />
      <CellWind kn={windKn} />
      <CellNum value={Math.round(gustKn)} muted />
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

function CellTime({ hour }: { hour: number }) {
  return (
    <View style={[styles.cell, styles.cellTime]}>
      <Text style={styles.cellTimeText}>{pad2(hour)}</Text>
    </View>
  );
}

function CellWind({ kn }: { kn: number }) {
  const tint = windTint(kn);
  return (
    <View style={[styles.cell, { backgroundColor: tint.bg }]}>
      <Text style={[styles.cellWindText, { color: tint.fg }]}>
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
        style={[
          styles.rideDot,
          rideable ? styles.rideDotOn : styles.rideDotOff,
        ]}
      />
    </View>
  );
}

function Arrow({ degrees }: { degrees: number }) {
  // Wind direction is "comes FROM"; downwind is +180°.
  const downwind = (degrees + 180) % 360;
  return (
    <View style={{ transform: [{ rotate: `${downwind}deg` }] }}>
      <Svg width={12} height={12} viewBox="0 0 12 12">
        <Path d="M6 1 L9.5 8 L6 6.5 L2.5 8 Z" fill="#3f3f46" />
      </Svg>
    </View>
  );
}

function windTint(kn: number): { bg: string; fg: string } {
  if (kn < 8) return { bg: "#fafafa", fg: "#a1a1aa" };
  if (kn < 15) return { bg: "#f0f9ff", fg: "#0369a1" };
  if (kn < 25) return { bg: "#d1fae5", fg: "#065f46" };
  if (kn < 35) return { bg: "#fef3c7", fg: "#78350f" };
  return { bg: "#fee2e2", fg: "#7f1d1d" };
}

function pad2(n: number): string {
  return n.toString().padStart(2, "0");
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
  cell: {
    height: ROW_HEIGHT,
    alignItems: "center",
    justifyContent: "center",
    borderBottomWidth: 1,
    borderBottomColor: "#f4f4f5",
  },
  cellTime: { backgroundColor: "#fafafa" },
  cellTimeText: {
    fontSize: 10,
    fontVariant: ["tabular-nums"],
    color: "#71717a",
  },
  cellWindText: {
    fontSize: 14,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
  },
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
