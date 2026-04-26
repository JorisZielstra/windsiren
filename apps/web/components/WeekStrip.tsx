"use client";

import { weekdayShort } from "@/components/dashboard-utils";

type Props = {
  dateKeys: string[];
  // Score for each dateKey, 0-100. Used for the colored bar under the
  // number; missing entries render as zero.
  weekScores: Map<string, { score: number; goCount: number; total: number }>;
  selectedDate: string;
  todayKey: string;
  onSelect: (dateKey: string) => void;
};

// Horizontal 7-day chip strip used by both the Today dashboard (where
// the score is "% of NL spots GO") and the spot detail page (where the
// score is "rideable-hours / 13 × 100" for one spot).
export function WeekStrip({
  dateKeys,
  weekScores,
  selectedDate,
  todayKey,
  onSelect,
}: Props) {
  if (dateKeys.length === 0) return null;
  return (
    <div className="border-t border-zinc-100 px-3 py-3 dark:border-zinc-900">
      <div className="grid auto-cols-fr grid-flow-col gap-1">
        {dateKeys.map((dateKey) => {
          const stats = weekScores.get(dateKey);
          const score = stats?.score ?? 0;
          const isSelected = dateKey === selectedDate;
          const isToday = dateKey === todayKey;
          const accent = scoreAccentClasses(score, isSelected);
          return (
            <button
              key={dateKey}
              type="button"
              onClick={() => onSelect(dateKey)}
              className={[
                "flex flex-col items-center rounded-md px-1 py-2 text-center transition-colors",
                isSelected
                  ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                  : "hover:bg-zinc-100 dark:hover:bg-zinc-900",
              ].join(" ")}
            >
              <span
                className={[
                  "text-[10px] font-semibold uppercase tracking-wide",
                  isSelected
                    ? "text-zinc-300 dark:text-zinc-600"
                    : isToday
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-zinc-500",
                ].join(" ")}
              >
                {isToday ? "Today" : weekdayShort(dateKey)}
              </span>
              <span className="mt-1 font-mono text-base font-bold tabular-nums">
                {score}
              </span>
              <span
                className={[
                  "mt-1 h-1 w-6 rounded-full",
                  isSelected ? "bg-white/40 dark:bg-zinc-900/40" : accent,
                ].join(" ")}
              />
            </button>
          );
        })}
      </div>
    </div>
  );
}

function scoreAccentClasses(score: number, isSelected: boolean): string {
  if (isSelected) return "";
  if (score >= 70) return "bg-emerald-500 dark:bg-emerald-400";
  if (score >= 40) return "bg-emerald-300 dark:bg-emerald-700";
  if (score >= 20) return "bg-amber-300 dark:bg-amber-700";
  return "bg-zinc-300 dark:bg-zinc-700";
}
