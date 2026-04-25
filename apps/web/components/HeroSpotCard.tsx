import Link from "next/link";
import { peakWindMs, type SpotWithVerdict } from "@windsiren/core";
import {
  cardinalDirection,
  DEFAULT_THRESHOLDS,
  isHourRideable,
  msToKnots,
} from "@windsiren/shared";

type Props = {
  item: SpotWithVerdict;
};

export function HeroSpotCard({ item }: Props) {
  const peak = peakWindMs(item.hours);
  const rideableCount = item.hours.filter((h) =>
    isHourRideable(h, item.spot, DEFAULT_THRESHOLDS),
  ).length;

  const decision = item.verdict?.decision;
  const verdictBg = decisionBg(decision);
  const verdictText = decisionText(decision);
  const verdictLabel = decisionLabel(decision);

  return (
    <Link
      href={`/spots/${item.spot.slug}`}
      className="block rounded-xl border border-zinc-200 bg-white p-6 transition-shadow hover:shadow-md dark:border-zinc-900 dark:bg-zinc-950"
    >
      <p className="text-xs font-semibold uppercase tracking-widest text-zinc-500">Today</p>
      <h2 className="mt-2 text-3xl font-bold tracking-tight text-zinc-950 dark:text-zinc-50">
        {item.spot.name}
      </h2>

      <div className="mt-5 flex flex-wrap items-baseline gap-x-6 gap-y-2">
        <span
          className={`rounded-full px-3 py-1 text-sm font-bold tracking-wider ${verdictBg} ${verdictText}`}
        >
          {verdictLabel}
        </span>
        {peak !== null ? (
          <div className="flex items-baseline gap-2">
            <span className="font-mono text-3xl font-semibold text-zinc-950 dark:text-zinc-50">
              {Math.round(msToKnots(peak))}
            </span>
            <span className="text-sm text-zinc-500">kn peak</span>
            <span className="text-sm text-zinc-700 dark:text-zinc-300">
              {peakDirection(item.hours)}
            </span>
          </div>
        ) : null}
      </div>

      <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">
        {rideableCount > 0 ? (
          <>
            <span className="font-semibold text-emerald-700 dark:text-emerald-400">
              {rideableCount}
            </span>{" "}
            rideable {rideableCount === 1 ? "hour" : "hours"} today
          </>
        ) : (
          "No rideable hours today"
        )}
      </p>

      <div className="mt-6 flex items-center justify-between border-t border-zinc-100 pt-4 dark:border-zinc-900">
        <span className="text-xs text-zinc-500">
          {item.spot.lat.toFixed(3)}°N, {item.spot.lng.toFixed(3)}°E
        </span>
        <span className="text-sm font-medium text-emerald-700 dark:text-emerald-400">
          Open spot →
        </span>
      </div>
    </Link>
  );
}

function peakDirection(hours: SpotWithVerdict["hours"]): string {
  if (hours.length === 0) return "";
  let best = hours[0]!;
  for (const h of hours) if (h.windSpeedMs > best.windSpeedMs) best = h;
  return cardinalDirection(best.windDirectionDeg);
}

function decisionBg(d: "go" | "marginal" | "no_go" | undefined): string {
  if (d === "go") return "bg-emerald-100 dark:bg-emerald-950";
  if (d === "marginal") return "bg-amber-100 dark:bg-amber-950";
  if (d === "no_go") return "bg-zinc-100 dark:bg-zinc-900";
  return "bg-zinc-100 dark:bg-zinc-900";
}

function decisionText(d: "go" | "marginal" | "no_go" | undefined): string {
  if (d === "go") return "text-emerald-800 dark:text-emerald-300";
  if (d === "marginal") return "text-amber-800 dark:text-amber-300";
  return "text-zinc-600 dark:text-zinc-400";
}

function decisionLabel(d: "go" | "marginal" | "no_go" | undefined): string {
  if (d === "go") return "GO";
  if (d === "marginal") return "MAYBE";
  if (d === "no_go") return "NO GO";
  return "—";
}
