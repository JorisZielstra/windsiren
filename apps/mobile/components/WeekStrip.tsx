import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { weekdayShort } from "./dashboard-utils";

type Props = {
  dateKeys: string[];
  weekScores: Map<string, { score: number; goCount: number; total: number }>;
  selectedDate: string;
  todayKey: string;
  onSelect: (dateKey: string) => void;
};

export function WeekStrip({
  dateKeys,
  weekScores,
  selectedDate,
  todayKey,
  onSelect,
}: Props) {
  if (dateKeys.length === 0) return null;
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.strip}
    >
      {dateKeys.map((dateKey) => {
        const stats = weekScores.get(dateKey);
        const score = stats?.score ?? 0;
        const isSelected = dateKey === selectedDate;
        const isToday = dateKey === todayKey;
        const accentBg = scoreAccentColor(score);
        return (
          <Pressable
            key={dateKey}
            onPress={() => onSelect(dateKey)}
            style={[styles.chip, isSelected && styles.chipSelected]}
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
            >
              {isToday ? "TODAY" : weekdayShort(dateKey)}
            </Text>
            <Text style={[styles.score, isSelected && styles.scoreSelected]}>
              {score}
            </Text>
            <View
              style={[
                styles.bar,
                isSelected ? styles.barSelected : { backgroundColor: accentBg },
              ]}
            />
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

function scoreAccentColor(score: number): string {
  if (score >= 70) return "#10b981";
  if (score >= 40) return "#6ee7b7";
  if (score >= 20) return "#fcd34d";
  return "#d4d4d8";
}

const styles = StyleSheet.create({
  strip: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 8,
    borderTopColor: "#f4f4f5",
    borderTopWidth: 1,
  },
  chip: {
    width: 56,
    paddingVertical: 8,
    alignItems: "center",
    borderRadius: 8,
  },
  chipSelected: { backgroundColor: "#18181b" },
  day: {
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 0.6,
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
});
