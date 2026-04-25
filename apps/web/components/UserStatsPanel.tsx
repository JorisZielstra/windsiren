import Link from "next/link";
import { msToKnots } from "@windsiren/shared";
import type { UserStats } from "@windsiren/core";

type Props = {
  stats: UserStats;
  topSpotName: string | null;
  topSpotSlug: string | null;
};

export function UserStatsPanel({ stats, topSpotName, topSpotSlug }: Props) {
  if (stats.sessionCount === 0) {
    return (
      <div className="rounded-md border border-zinc-200 px-4 py-6 text-center text-sm text-zinc-500 dark:border-zinc-800">
        No stats yet — log a session to start the leaderboard.
      </div>
    );
  }

  return (
    <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      <Stat label="Sessions" value={stats.sessionCount.toString()} />
      <Stat label="Total time" value={formatHours(stats.totalMinutes)} />
      <Stat
        label="Longest session"
        value={
          stats.longestSessionMinutes != null
            ? formatHours(stats.longestSessionMinutes)
            : "—"
        }
      />
      <Stat
        label="Highest jump"
        value={stats.biggestJumpM != null ? `${stats.biggestJumpM.toFixed(1)} m` : "—"}
        accent={stats.biggestJumpM != null}
      />
      <Stat
        label="Strongest gust"
        value={
          stats.biggestGustMs != null
            ? `${Math.round(msToKnots(stats.biggestGustMs))} kn`
            : "—"
        }
      />
      <Stat
        label="Top spot"
        value={
          topSpotName && topSpotSlug ? (
            <Link href={`/spots/${topSpotSlug}`} className="hover:underline">
              {topSpotName}
            </Link>
          ) : (
            "—"
          )
        }
        sub={
          stats.topSpot
            ? `${stats.topSpot.sessionCount} session${stats.topSpot.sessionCount === 1 ? "" : "s"}`
            : null
        }
      />
    </dl>
  );
}

function Stat({
  label,
  value,
  sub,
  accent = false,
}: {
  label: string;
  value: React.ReactNode;
  sub?: string | null;
  accent?: boolean;
}) {
  return (
    <div className="rounded-md border border-zinc-200 px-4 py-3 dark:border-zinc-800">
      <dt className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
        {label}
      </dt>
      <dd
        className={[
          "mt-1 font-mono text-xl font-bold tracking-tight",
          accent ? "text-emerald-600 dark:text-emerald-400" : "",
        ].join(" ")}
      >
        {value}
      </dd>
      {sub ? <div className="mt-0.5 text-[10px] text-zinc-500">{sub}</div> : null}
    </div>
  );
}

function formatHours(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const hours = minutes / 60;
  if (hours < 10) return `${hours.toFixed(1)} h`;
  return `${Math.round(hours)} h`;
}
