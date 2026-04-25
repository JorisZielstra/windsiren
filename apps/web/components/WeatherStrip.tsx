import Link from "next/link";
import { fetchTodayVerdict, pickHomeSpot } from "@windsiren/core";
import { cardinalDirection, msToKnots } from "@windsiren/shared";
import { createSupabaseServerClient } from "@/lib/supabase-server";

// Always-visible status strip showing the home spot's current condition.
// Renders nothing if the spots table is empty.
export async function WeatherStrip() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const spot = await pickHomeSpot(supabase, user?.id ?? null);
  if (!spot) return null;

  const result = await fetchTodayVerdict(spot);
  const verdict = result.verdict;
  const peakHour = pickPeakHour(result.hours);

  const dotCls = verdictDotClass(verdict?.decision);
  const labelText = verdict
    ? verdictLabel(verdict.decision)
    : "No data";

  return (
    <Link
      href={`/spots/${spot.slug}`}
      className="block border-b border-zinc-200 bg-white transition-colors hover:bg-zinc-50 dark:border-zinc-900 dark:bg-zinc-950 dark:hover:bg-zinc-900/60"
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-6 py-2.5 text-sm">
        <div className="flex items-center gap-3 min-w-0">
          <span className={`inline-block h-2 w-2 shrink-0 rounded-full ${dotCls}`} />
          <span className="truncate font-medium text-zinc-900 dark:text-zinc-50">
            {spot.name}
          </span>
          <span className="hidden text-zinc-500 sm:inline">·</span>
          {peakHour ? (
            <span className="hidden text-zinc-700 sm:inline dark:text-zinc-300 font-mono">
              {Math.round(msToKnots(peakHour.windSpeedMs))} kn{" "}
              <span className="text-zinc-500">
                {cardinalDirection(peakHour.windDirectionDeg)}
              </span>
            </span>
          ) : null}
          <span className="hidden text-zinc-500 sm:inline">·</span>
          <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
            {labelText}
          </span>
        </div>
        <span className="text-xs text-zinc-500">→</span>
      </div>
    </Link>
  );
}

function pickPeakHour(hours: { windSpeedMs: number; windDirectionDeg: number; time: string }[]) {
  if (!hours || hours.length === 0) return null;
  let best = hours[0]!;
  for (const h of hours) {
    if (h.windSpeedMs > best.windSpeedMs) best = h;
  }
  return best;
}

function verdictDotClass(decision: "go" | "marginal" | "no_go" | undefined): string {
  if (decision === "go") return "bg-emerald-500";
  if (decision === "marginal") return "bg-amber-500";
  if (decision === "no_go") return "bg-zinc-400 dark:bg-zinc-600";
  return "bg-zinc-300 dark:bg-zinc-700";
}

function verdictLabel(decision: "go" | "marginal" | "no_go"): string {
  if (decision === "go") return "Go";
  if (decision === "marginal") return "Maybe";
  return "No go";
}
