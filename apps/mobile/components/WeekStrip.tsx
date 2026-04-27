import { Pressable, StyleSheet, Text, View } from "react-native";
import { formatWeekdayDate } from "./dashboard-utils";

type Props = {
  visibleDates: string[];
  weekScores: Map<string, { score: number; goCount: number; total: number }>;
  selectedDate: string;
  todayKey: string;
  onSelect: (dateKey: string) => void;
  onPrevWeek?: () => void;
  onNextWeek?: () => void;
};

export function WeekStrip({
  visibleDates,
  weekScores,
  selectedDate,
  todayKey,
  onSelect,
  onPrevWeek,
  onNextWeek,
}: Props) {
  if (visibleDates.length === 0) return null;
  return (
    <View style={styles.row}>
      <CarouselButton direction="prev" onPress={onPrevWeek} />
      <View style={styles.chipsRow}>
        {visibleDates.map((dateKey) => {
          const stats = weekScores.get(dateKey);
          const hasData = stats !== undefined;
          const score = stats?.score ?? 0;
          const isSelected = dateKey === selectedDate;
          const isToday = dateKey === todayKey;
          const accentBg = scoreAccentColor(score);
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
                {hasData ? score : "—"}
              </Text>
              <View
                style={[
                  styles.bar,
                  isSelected
                    ? styles.barSelected
                    : hasData
                      ? { backgroundColor: accentBg }
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

function scoreAccentColor(score: number): string {
  if (score >= 70) return "#10b981";
  if (score >= 40) return "#6ee7b7";
  if (score >= 20) return "#fcd34d";
  return "#d4d4d8";
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
  bar: { marginTop: 4, height: 3, width: 24, borderRadius: 999 },
  barSelected: { backgroundColor: "rgba(255,255,255,0.4)" },
  barNoData: { backgroundColor: "#e4e4e7" },
});
