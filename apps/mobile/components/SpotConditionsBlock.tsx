import { useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { type SpotWeek, type SpotWithVerdict } from "@windsiren/core";
import { msToKnots } from "@windsiren/shared";
import {
  addDaysToKey,
  countRideable,
  daylightHours,
  mondayOfDate,
  weekDates,
} from "./dashboard-utils";
import {
  AirTempTile,
  DaylightTile,
  PeakWindowTile,
  Tile,
  TrendTile,
  WindTile,
} from "./DayTiles";
import { TileModal, type TileKey } from "./TileModal";
import { WeekStrip, type WeekScoreEntry } from "./WeekStrip";

type Props = {
  spotWeek: SpotWeek;
  todayKey: string;
  // When true, the inner "Conditions for X" header is hidden — useful when
  // an outer CollapsibleSection has already taken over the title bar.
  headless?: boolean;
};

export function SpotConditionsBlock({ spotWeek, todayKey, headless = false }: Props) {
  const dateKeys = useMemo(
    () => spotWeek.days.map((d) => d.dateKey).sort(),
    [spotWeek],
  );
  const [selectedDate, setSelectedDate] = useState<string>(
    dateKeys.includes(todayKey) ? todayKey : (dateKeys[0] ?? todayKey),
  );
  const [activeTile, setActiveTile] = useState<TileKey | null>(null);

  const dayItem: SpotWithVerdict = useMemo(() => {
    const day = spotWeek.days.find((d) => d.dateKey === selectedDate);
    return {
      spot: spotWeek.spot,
      verdict: day?.verdict ?? null,
      hours: day?.hours ?? [],
    };
  }, [spotWeek, selectedDate]);

  const dayItems = useMemo(() => [dayItem], [dayItem]);

  const weekScores = useMemo(() => {
    const out = new Map<string, WeekScoreEntry>();
    for (const day of spotWeek.days) {
      const rideable = countRideable({
        spot: spotWeek.spot,
        verdict: day.verdict,
        hours: day.hours,
      });
      const score = Math.round((Math.min(13, rideable) / 13) * 100);
      const daylight = daylightHours(day.hours);
      const avgWindKn =
        daylight.length > 0
          ? Math.round(
              msToKnots(
                daylight.reduce((s, h) => s + h.windSpeedMs, 0) /
                  daylight.length,
              ),
            )
          : null;
      out.set(day.dateKey, {
        score,
        goCount: rideable >= 3 ? 1 : 0,
        total: 1,
        avgWindKn,
      });
    }
    return out;
  }, [spotWeek]);

  return (
    <View style={[styles.card, headless && styles.cardFlush]}>
      {headless ? null : (
        <View style={styles.header}>
          <Text style={styles.heading}>
            Conditions for {spotWeek.spot.name}
          </Text>
          <Text style={styles.subheading}>
            Tap a day to pivot · tap a tile for hourly chart
          </Text>
        </View>
      )}

      <WeekStrip
        visibleDates={weekDates(mondayOfDate(selectedDate))}
        weekScores={weekScores}
        selectedDate={selectedDate}
        todayKey={todayKey}
        onSelect={setSelectedDate}
        onPrevWeek={
          dateKeys.length > 0 && mondayOfDate(selectedDate) > dateKeys[0]!
            ? () => {
                const target = addDaysToKey(selectedDate, -7);
                setSelectedDate(target < dateKeys[0]! ? dateKeys[0]! : target);
              }
            : undefined
        }
        onNextWeek={
          dateKeys.length > 0 &&
          addDaysToKey(mondayOfDate(selectedDate), 6) <
            dateKeys[dateKeys.length - 1]!
            ? () => {
                const target = addDaysToKey(selectedDate, 7);
                const last = dateKeys[dateKeys.length - 1]!;
                setSelectedDate(target > last ? last : target);
              }
            : undefined
        }
      />

      <View style={styles.tileGrid}>
        <VerdictTile item={dayItem} onPress={() => setActiveTile("verdict")} />
        <WindTile item={dayItem} onPress={() => setActiveTile("wind")} />
        <AirTempTile
          item={dayItem}
          showSpotName={false}
          onPress={() => setActiveTile("airTemp")}
        />
        <PeakWindowTile
          dayItems={dayItems}
          item={dayItem}
          showSpotName={false}
          onPress={() => setActiveTile("peakWindow")}
        />
        <DaylightTile
          item={dayItem}
          selectedDate={selectedDate}
          onPress={() => setActiveTile("daylight")}
        />
        <TrendTile
          item={dayItem}
          showSpotName={false}
          onPress={() => setActiveTile("trend")}
        />
      </View>

      <TileModal
        tile={activeTile === "score" || activeTile === "friends" ? null : activeTile}
        onClose={() => setActiveTile(null)}
        dayItems={dayItems}
        bestSpot={dayItem}
        spotWeeks={[spotWeek]}
        selectedDate={selectedDate}
        friends={{ count: 0, profiles: [] }}
      />
    </View>
  );
}

function VerdictTile({
  item,
  onPress,
}: {
  item: SpotWithVerdict;
  onPress?: () => void;
}) {
  const decision = item.verdict?.decision ?? null;
  const rideable = countRideable(item);
  const label =
    decision === "go"
      ? "GO"
      : decision === "marginal"
        ? "MAYBE"
        : decision === "no_go"
          ? "NO GO"
          : "—";
  const accentStyle =
    decision === "go"
      ? styles.verdictGo
      : decision === "marginal"
        ? styles.verdictMarginal
        : styles.verdictNeutral;
  return (
    <Tile
      label="VERDICT"
      sub={`${rideable} rideable hour${rideable === 1 ? "" : "s"}`}
      onPress={onPress}
    >
      <Text style={[styles.verdictText, accentStyle]}>{label}</Text>
    </Tile>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#fff",
    borderColor: "#e4e4e7",
    borderWidth: 1,
    borderRadius: 12,
    overflow: "hidden",
  },
  cardFlush: {
    borderWidth: 0,
    borderRadius: 0,
  },
  header: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 8 },
  heading: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.2,
    color: "#71717a",
    textTransform: "uppercase",
  },
  subheading: { marginTop: 4, fontSize: 11, color: "#a1a1aa" },
  tileGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    borderTopColor: "#f4f4f5",
    borderTopWidth: 1,
  },
  verdictText: {
    fontSize: 20,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
  },
  verdictGo: { color: "#059669" },
  verdictMarginal: { color: "#d97706" },
  verdictNeutral: { color: "#3f3f46" },
});
