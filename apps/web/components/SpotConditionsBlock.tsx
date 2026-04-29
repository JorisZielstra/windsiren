"use client";

import { useMemo, useState } from "react";
import { type SpotWeek, type SpotWithVerdict } from "@windsiren/core";
import {
  AirTempTile,
  DaylightTile,
  PeakWindowTile,
  Tile,
  TrendTile,
  WindTile,
} from "@/components/DayTiles";
import {
  addDaysToKey,
  countRideable,
  daylightHours,
  mondayOfDate,
  weekDates,
} from "@/components/dashboard-utils";
import { TileModal, type TileKey } from "@/components/TileModal";
import { WeekStrip, type WeekScoreEntry } from "@/components/WeekStrip";
import { msToKnots } from "@windsiren/shared";

type Props = {
  spotWeek: SpotWeek;
  todayKey: string;
  // When true, drop the outer rounded border — used when nested inside
  // a parent card that already provides it (e.g. spot detail page).
  flush?: boolean;
  // When true, the inner "Conditions for X" header is hidden — useful when
  // an outer collapsible has already taken over the title bar.
  headless?: boolean;
};

// Per-spot version of the home dashboard's tile grid + week strip. Lives
// at the top of /spots/[slug] so kiters can scan the spot's week, pivot
// to any day, and click into hourly charts — same affordances as the
// home dashboard, scoped to one spot.
//
// Per-day score formula (different from the dashboard's "% of NL spots
// GO"): rideable-hours / 13 × 100. 13 is the max NL daylight hours
// (08:00–20:00 local), so a banger day caps at 100.
export function SpotConditionsBlock({
  spotWeek,
  todayKey,
  flush = false,
  headless = false,
}: Props) {
  const dateKeys = useMemo(
    () => spotWeek.days.map((d) => d.dateKey).sort(),
    [spotWeek],
  );
  const [selectedDate, setSelectedDate] = useState<string>(
    dateKeys.includes(todayKey) ? todayKey : (dateKeys[0] ?? todayKey),
  );
  const [activeTile, setActiveTile] = useState<TileKey | null>(null);

  // The day's slice as a SpotWithVerdict — same shape every tile expects.
  const dayItem: SpotWithVerdict = useMemo(() => {
    const day = spotWeek.days.find((d) => d.dateKey === selectedDate);
    return {
      spot: spotWeek.spot,
      verdict: day?.verdict ?? null,
      hours: day?.hours ?? [],
    };
  }, [spotWeek, selectedDate]);

  // For TileModal's "score breakdown" chart and PeakWindowTile's gust
  // subtitle, we pass a single-element list — the spot itself.
  const dayItems = useMemo(() => [dayItem], [dayItem]);

  // Per-day score map for the WeekStrip. Tracks rideable hours so the
  // headline number matches the per-spot scoring; bar color comes from
  // the day's avg wind, same Windguru palette as the forecast table.
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
    <section
      className={[
        "bg-white dark:bg-zinc-950",
        headless
          ? ""
          : flush
            ? "border-t border-zinc-100 dark:border-zinc-900"
            : "rounded-xl border border-zinc-200 dark:border-zinc-800",
      ].join(" ")}
    >
      {headless ? null : (
        <div className="px-6 pt-5 pb-3">
          <p className="text-xs font-semibold uppercase tracking-widest text-zinc-500">
            Conditions for {spotWeek.spot.name}
          </p>
          <p className="mt-1 text-xs text-zinc-500">
            Tap a day to pivot · tap a tile for hourly chart
          </p>
        </div>
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

      <div className="grid grid-cols-1 gap-px border-t border-zinc-100 bg-zinc-100 sm:grid-cols-2 lg:grid-cols-3 dark:border-zinc-900 dark:bg-zinc-900">
        <VerdictTile item={dayItem} onClick={() => setActiveTile("verdict")} />
        <WindTile item={dayItem} onClick={() => setActiveTile("wind")} />
        <AirTempTile
          item={dayItem}
          showSpotName={false}
          onClick={() => setActiveTile("airTemp")}
        />
        <PeakWindowTile
          dayItems={dayItems}
          item={dayItem}
          showSpotName={false}
          onClick={() => setActiveTile("peakWindow")}
        />
        <DaylightTile
          item={dayItem}
          selectedDate={selectedDate}
          onClick={() => setActiveTile("daylight")}
        />
        <TrendTile
          item={dayItem}
          showSpotName={false}
          onClick={() => setActiveTile("trend")}
        />
      </div>

      <TileModal
        tile={activeTile === "score" || activeTile === "friends" ? null : activeTile}
        onClose={() => setActiveTile(null)}
        dayItems={dayItems}
        bestSpot={dayItem}
        spotWeeks={[spotWeek]}
        selectedDate={selectedDate}
        friends={{ count: 0, profiles: [] }}
      />
    </section>
  );
}

// Verdict headline for the selected day. Click opens the same hourly
// wind chart as Peak window so kiters can see *where* the rideable hours
// fall, not just their count.
function VerdictTile({
  item,
  onClick,
}: {
  item: SpotWithVerdict;
  onClick?: () => void;
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
  const accent =
    decision === "go"
      ? "text-emerald-600 dark:text-emerald-400"
      : decision === "marginal"
        ? "text-amber-600 dark:text-amber-400"
        : "text-zinc-700 dark:text-zinc-300";
  return (
    <Tile
      label="Verdict"
      sub={`${rideable} rideable hour${rideable === 1 ? "" : "s"}`}
      onClick={onClick}
    >
      <span className={`font-mono text-2xl font-bold tracking-tight ${accent}`}>
        {label}
      </span>
    </Tile>
  );
}
