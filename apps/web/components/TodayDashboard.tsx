import Link from "next/link";
import {
  averageDirectionDeg,
  classifyWindTrend,
  getSunTimes,
  type PublicProfile,
  type SpotWithVerdict,
  type WindTrend,
} from "@windsiren/core";
import {
  cardinalDirection,
  DEFAULT_THRESHOLDS,
  isHourRideable,
  msToKnots,
  type HourlyForecast,
} from "@windsiren/shared";
import { DirectionNeedle } from "@/components/DirectionNeedle";

type Props = {
  withVerdicts: SpotWithVerdict[];
  bestSpot: SpotWithVerdict | null;
  todayLabel: string; // e.g. "Wed, Apr 26"
  friendsCount: number;
  friendsPreview: PublicProfile[];
  signedIn: boolean;
};

export function TodayDashboard({
  withVerdicts,
  bestSpot,
  todayLabel,
  friendsCount,
  friendsPreview,
  signedIn,
}: Props) {
  const total = withVerdicts.length;
  const goCount = withVerdicts.filter((v) => v.verdict?.decision === "go").length;
  const dayScore = total > 0 ? Math.round((goCount / total) * 100) : 0;
  const dayLabel = labelForScore(dayScore);
  const scoreAccent = dayScore >= 40;

  return (
    <section className="rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
      {/* Hero: day score */}
      <div className="px-6 pt-5 pb-4">
        <div className="flex items-baseline justify-between">
          <p className="text-xs font-semibold uppercase tracking-widest text-zinc-500">
            Today
          </p>
          <p className="text-xs text-zinc-500">{todayLabel}</p>
        </div>

        {total === 0 ? (
          <p className="mt-4 text-sm text-zinc-500">No spot data right now.</p>
        ) : (
          <div className="mt-3 flex items-end gap-6">
            <div className="leading-none">
              <span
                className={[
                  "font-mono text-6xl font-bold tracking-tight",
                  scoreAccent
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-zinc-900 dark:text-zinc-100",
                ].join(" ")}
              >
                {dayScore}
              </span>
              <span className="ml-1 text-sm text-zinc-500">/ 100</span>
            </div>
            <div className="flex-1 pb-1">
              <div className="text-lg font-semibold">{dayLabel}</div>
              <div className="mt-0.5 text-sm text-zinc-500">
                <span className="font-mono font-semibold text-zinc-900 dark:text-zinc-100">
                  {goCount}
                </span>{" "}
                of {total} spots GO
              </div>
              {bestSpot ? (
                <Link
                  href={`/spots/${bestSpot.spot.slug}`}
                  className="mt-1 inline-block text-sm text-emerald-700 hover:underline dark:text-emerald-400"
                >
                  Best: {bestSpot.spot.name} ·{" "}
                  {countRideable(bestSpot)}h GO →
                </Link>
              ) : null}
            </div>
          </div>
        )}

        {/* Score bar */}
        {total > 0 ? (
          <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-900">
            <div
              className={[
                "h-full",
                scoreAccent
                  ? "bg-emerald-500 dark:bg-emerald-400"
                  : "bg-zinc-400 dark:bg-zinc-600",
              ].join(" ")}
              style={{ width: `${dayScore}%` }}
            />
          </div>
        ) : null}
      </div>

      {/* Tile grid */}
      <div className="grid grid-cols-1 gap-px border-t border-zinc-100 bg-zinc-100 sm:grid-cols-2 lg:grid-cols-3 dark:border-zinc-900 dark:bg-zinc-900">
        <WindTile bestSpot={bestSpot} />
        <AirTempTile bestSpot={bestSpot} />
        {signedIn ? (
          <FriendsTile count={friendsCount} preview={friendsPreview} />
        ) : (
          <SignInTile />
        )}
        <PeakWindowTile withVerdicts={withVerdicts} bestSpot={bestSpot} />
        <DaylightTile bestSpot={bestSpot} />
        <TrendTile bestSpot={bestSpot} />
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Tiles
// ---------------------------------------------------------------------------

function WindTile({ bestSpot }: { bestSpot: SpotWithVerdict | null }) {
  if (!bestSpot) return <Tile label="Wind">—</Tile>;
  const dirs = daylightHours(bestSpot.hours).map((h) => h.windDirectionDeg);
  if (dirs.length === 0) return <Tile label="Wind">—</Tile>;
  const avgDeg = averageDirectionDeg(dirs);
  return (
    <Tile label="Wind avg">
      <div className="flex items-center gap-2">
        <DirectionNeedle directionDeg={avgDeg} size={36} />
        <div className="leading-tight">
          <div className="font-mono text-2xl font-bold tracking-tight">
            {cardinalDirection(avgDeg)}
          </div>
          <div className="text-[10px] uppercase tracking-wide text-zinc-500">
            {Math.round(avgDeg)}°
          </div>
        </div>
      </div>
    </Tile>
  );
}

function AirTempTile({ bestSpot }: { bestSpot: SpotWithVerdict | null }) {
  if (!bestSpot) return <Tile label="Air temp">—</Tile>;
  const temps = daylightHours(bestSpot.hours)
    .map((h) => h.airTempC)
    .filter((t): t is number => t != null);
  if (temps.length === 0) return <Tile label="Air temp">—</Tile>;
  const avg = temps.reduce((s, x) => s + x, 0) / temps.length;
  return (
    <Tile label="Air temp" sub={`at ${bestSpot.spot.name}`}>
      <span className="font-mono text-2xl font-bold tracking-tight">
        {Math.round(avg)}°C
      </span>
    </Tile>
  );
}

function FriendsTile({
  count,
  preview,
}: {
  count: number;
  preview: PublicProfile[];
}) {
  const names = preview.slice(0, 2).map((p) => p.display_name ?? "Someone");
  const extra = Math.max(0, count - names.length);
  return (
    <Tile label="Friends" sub="out today">
      <span
        className={[
          "font-mono text-2xl font-bold tracking-tight",
          count > 0 ? "text-emerald-600 dark:text-emerald-400" : "",
        ].join(" ")}
      >
        {count}
      </span>
      {names.length > 0 ? (
        <div className="mt-1 truncate text-xs text-zinc-500">
          {names.join(" · ")}
          {extra > 0 ? ` +${extra}` : ""}
        </div>
      ) : null}
    </Tile>
  );
}

function SignInTile() {
  return (
    <Tile label="Friends">
      <Link
        href="/auth/sign-in"
        className="text-sm text-emerald-700 hover:underline dark:text-emerald-400"
      >
        Sign in →
      </Link>
    </Tile>
  );
}

function PeakWindowTile({
  withVerdicts,
  bestSpot,
}: {
  withVerdicts: SpotWithVerdict[];
  bestSpot: SpotWithVerdict | null;
}) {
  if (!bestSpot) return <Tile label="Peak window">—</Tile>;
  const window = longestRideableRun(bestSpot);
  // Strongest gust across all spots, with its spot name.
  let peakGustMs = 0;
  let peakGustSpotName: string | null = null;
  for (const v of withVerdicts) {
    for (const h of v.hours) {
      if (h.gustMs > peakGustMs) {
        peakGustMs = h.gustMs;
        peakGustSpotName = v.spot.name;
      }
    }
  }
  if (!window) {
    return (
      <Tile label="Peak window" sub={peakGustSpotName ? `gust ${Math.round(msToKnots(peakGustMs))} kn at ${peakGustSpotName}` : undefined}>
        —
      </Tile>
    );
  }
  return (
    <Tile
      label="Peak window"
      sub={
        peakGustSpotName
          ? `gust ${Math.round(msToKnots(peakGustMs))} kn at ${peakGustSpotName}`
          : undefined
      }
    >
      <span className="font-mono text-2xl font-bold tracking-tight">
        {pad2(window.startHour)}–{pad2(window.endHour)}h
      </span>
    </Tile>
  );
}

function DaylightTile({ bestSpot }: { bestSpot: SpotWithVerdict | null }) {
  if (!bestSpot) return <Tile label="Daylight">—</Tile>;
  const { sunrise, sunset } = getSunTimes(
    bestSpot.spot.lat,
    bestSpot.spot.lng,
    new Date(),
  );
  const lengthMs = sunset.getTime() - sunrise.getTime();
  const hours = Math.floor(lengthMs / 3600000);
  const minutes = Math.floor((lengthMs % 3600000) / 60000);
  return (
    <Tile label="Daylight" sub={`${hours}h ${minutes}m`}>
      <span className="font-mono text-2xl font-bold tracking-tight">
        {fmtNlClock(sunrise)} → {fmtNlClock(sunset)}
      </span>
    </Tile>
  );
}

function TrendTile({ bestSpot }: { bestSpot: SpotWithVerdict | null }) {
  if (!bestSpot) return <Tile label="Trend">—</Tile>;
  const trend = classifyWindTrend(bestSpot.hours);
  const arrow = trend === "rising" ? "↑" : trend === "dropping" ? "↓" : "→";
  const accent =
    trend === "rising"
      ? "text-emerald-600 dark:text-emerald-400"
      : trend === "dropping"
        ? "text-amber-600 dark:text-amber-400"
        : "text-zinc-700 dark:text-zinc-300";
  return (
    <Tile label="Trend" sub={`at ${bestSpot.spot.name}`}>
      <span className={`font-mono text-2xl font-bold tracking-tight ${accent}`}>
        {arrow} {labelForTrend(trend)}
      </span>
    </Tile>
  );
}

// ---------------------------------------------------------------------------
// Building blocks
// ---------------------------------------------------------------------------

function Tile({
  label,
  sub,
  children,
}: {
  label: string;
  sub?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white p-4 dark:bg-zinc-950">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
        {label}
      </div>
      <div className="mt-1.5">{children}</div>
      {sub ? <div className="mt-1 truncate text-xs text-zinc-500">{sub}</div> : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function labelForScore(score: number): string {
  if (score >= 70) return "Banger day";
  if (score >= 40) return "Solid day";
  if (score >= 20) return "Pockets of action";
  return "Mellow day";
}

function labelForTrend(t: WindTrend): string {
  if (t === "rising") return "rising";
  if (t === "dropping") return "dropping";
  return "holding";
}

function countRideable(item: SpotWithVerdict): number {
  return item.hours.filter((h) =>
    isHourRideable(h, item.spot, DEFAULT_THRESHOLDS),
  ).length;
}

// Returns the longest contiguous run of rideable daylight hours at this
// spot, or null if there isn't one. Hour bounds are NL local hours.
function longestRideableRun(
  item: SpotWithVerdict,
): { startHour: number; endHour: number } | null {
  const daylight = daylightHours(item.hours);
  let bestStart: number | null = null;
  let bestLen = 0;
  let curStart: number | null = null;
  let curLen = 0;
  for (const h of daylight) {
    if (isHourRideable(h, item.spot, DEFAULT_THRESHOLDS)) {
      if (curStart === null) curStart = nlLocalHour(new Date(h.time));
      curLen += 1;
    } else {
      if (curLen > bestLen && curStart !== null) {
        bestStart = curStart;
        bestLen = curLen;
      }
      curStart = null;
      curLen = 0;
    }
  }
  if (curLen > bestLen && curStart !== null) {
    bestStart = curStart;
    bestLen = curLen;
  }
  if (bestStart === null || bestLen === 0) return null;
  return { startHour: bestStart, endHour: bestStart + bestLen };
}

function daylightHours(hours: HourlyForecast[]): HourlyForecast[] {
  return hours.filter((h) => {
    const localHour = nlLocalHour(new Date(h.time));
    return localHour >= 8 && localHour <= 20;
  });
}

function nlLocalHour(d: Date): number {
  const hh = new Intl.DateTimeFormat("en-NL", {
    timeZone: "Europe/Amsterdam",
    hour: "2-digit",
    hour12: false,
  }).format(d);
  return parseInt(hh, 10);
}

function fmtNlClock(d: Date): string {
  return new Intl.DateTimeFormat("en-NL", {
    timeZone: "Europe/Amsterdam",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(d);
}

function pad2(n: number): string {
  return n.toString().padStart(2, "0");
}
