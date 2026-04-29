import { Pressable, StyleSheet, Text, View } from "react-native";
import { windKnColor } from "@windsiren/shared";
import { formatWeekdayDate } from "./dashboard-utils";

export type WeekScoreEntry = {
  score: number;
  goCount: number;
  total: number;
  // Average wind kn over the day's daylight hours; null when no data.
  // Drives bar color via the same Windguru palette as the forecast table.
  avgWindKn: number | null;
};

type Props = {
  visibleDates: string[];
  weekScores: Map<string, WeekScoreEntry>;
  selectedDate: string;
  todayKey: string;
  onSelect: (dateKey: string) => void;
  onPrevWeek?: () => void;
  onNextWeek?: () => void;
  // What number to render under the weekday label.
  //   "score" — 0–100 % GO out of total (per-spot rideable-hours view)
  //   "count" — raw count of GO spots (dashboard view, where a few GO
  //             out of 64 rounds to 0% and looks broken)
  display?: "score" | "count";
};

export function WeekStrip({
  visibleDates,
  weekScores,
  selectedDate,
  todayKey,
  onSelect,
  onPrevWeek,
  onNextWeek,
  display = "score",
}: Props) {
  if (visibleDates.length === 0) return null;
  return (
    <View style={styles.row}>
      <CarouselButton direction="prev" onPress={onPrevWeek} />
      <View style={styles.chipsRow}>
        {visibleDates.map((dateKey) => {
          const stats = weekScores.get(dateKey);
          const hasData = stats !== undefined;
          const value =
            display === "count"
              ? (stats?.goCount ?? 0)
              : (stats?.score ?? 0);
          const isSelected = dateKey === selectedDate;
          const isToday = dateKey === todayKey;
          // Bar color: Windguru palette when wind data is available,
          // matching the forecast table cells. Falls through to neutral
          // when no data; selected state still uses its own white.
          const barTint =
            !isSelected && hasData && stats!.avgWindKn !== null
              ? windKnColor(stats!.avgWindKn)
              : null;
          return (
            <Pressable
              key={dateKey}
              onPress={() => onSelect(dateKey)}
              style={[
                styles.chip,
                isSelected && styles.chipSelected,
                !hasData && !isSelected && { opacity: 0.5 },
              ]}
            >
              <Text
                style={[
                  styles.day,
                  isSelected
                    ? styles.daySelected
                    : isToday
                      ? styles.dayToday
                      : null,
                ]}
                numberOfLines={1}
              >
                {isToday ? "TODAY" : formatWeekdayDate(dateKey)}
              </Text>
              <Text style={[styles.score, isSelected && styles.scoreSelected]}>
                {hasData ? value : "—"}
              </Text>
              {display === "count" && hasData && stats!.total > 1 ? (
                <Text
                  style={[
                    styles.countTotal,
                    isSelected && styles.countTotalSelected,
                  ]}
                >
                  of {stats!.total} GO
                </Text>
              ) : null}
              <View
                style={[
                  styles.bar,
                  isSelected
                    ? styles.barSelected
                    : barTint
                      ? { backgroundColor: barTint.bg }
                      : styles.barNoData,
                ]}
              />
            </Pressable>
          );
        })}
      </View>
      <CarouselButton direction="next" onPress={onNextWeek} />
    </View>
  );
}

function CarouselButton({
  direction,
  onPress,
}: {
  direction: "prev" | "next";
  onPress?: () => void;
}) {
  const disabled = !onPress;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[styles.arrowBtn, disabled && { opacity: 0.3 }]}
      hitSlop={8}
    >
      <Text style={styles.arrowText}>{direction === "prev" ? "‹" : "›"}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "stretch",
    borderTopColor: "#f4f4f5",
    borderTopWidth: 1,
  },
  arrowBtn: {
    width: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  arrowText: { fontSize: 22, color: "#71717a" },
  chipsRow: {
    flex: 1,
    flexDirection: "row",
    gap: 4,
    paddingHorizontal: 4,
    paddingVertical: 10,
  },
  chip: {
    flex: 1,
    paddingVertical: 8,
    alignItems: "center",
    borderRadius: 8,
  },
  chipSelected: { backgroundColor: "#18181b" },
  day: {
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 0.4,
    color: "#71717a",
  },
  dayToday: { color: "#059669" },
  daySelected: { color: "#a1a1aa" },
  score: {
    marginTop: 4,
    fontSize: 16,
    fontWeight: "700",
    color: "#18181b",
    fontVariant: ["tabular-nums"],
  },
  scoreSelected: { color: "#fff" },
  countTotal: {
    marginTop: 1,
    fontSize: 8,
    fontWeight: "600",
    letterSpacing: 0.4,
    color: "#a1a1aa",
    fontVariant: ["tabular-nums"],
  },
  countTotalSelected: { color: "rgba(255,255,255,0.6)" },
  bar: { marginTop: 4, height: 3, width: 24, borderRadius: 999 },
  barSelected: { backgroundColor: "rgba(255,255,255,0.4)" },
  barNoData: { backgroundColor: "#e4e4e7" },
});
