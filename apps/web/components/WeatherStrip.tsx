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
      className="block border-b border-border bg-paper-2 transition-colors hover:bg-paper-sunk"
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-6 py-2.5 text-sm">
        <div className="flex items-center gap-3 min-w-0">
          <span className={`inline-block h-2 w-2 shrink-0 rounded-full ${dotCls}`} />
          <span className="truncate font-semibold text-ink">{spot.name}</span>
          <span className="hidden text-ink-faint sm:inline">·</span>
          {peakHour ? (
            <span className="hidden font-mono text-ink-2 sm:inline">
              {Math.round(msToKnots(peakHour.windSpeedMs))} kn{" "}
              <span className="text-ink-mute">
                {cardinalDirection(peakHour.windDirectionDeg)}
              </span>
            </span>
          ) : null}
          <span className="hidden text-ink-faint sm:inline">·</span>
          <span className="text-[11px] font-bold uppercase tracking-[0.15em] text-ink-mute">
            {labelText}
          </span>
        </div>
        <span className="text-xs text-ink-faint">→</span>
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
  if (decision === "go") return "bg-go";
  if (decision === "marginal") return "bg-maybe";
  if (decision === "no_go") return "bg-no-go";
  return "bg-ink-faint";
}

function verdictLabel(decision: "go" | "marginal" | "no_go"): string {
  if (decision === "go") return "Go";
  if (decision === "marginal") return "Maybe";
  return "No go";
}
