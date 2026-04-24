import Link from "next/link";
import { notFound } from "next/navigation";
import {
  cardinalDirection,
  evaluateDay,
  INTERMEDIATE_THRESHOLDS,
  isHourRideable,
  msToKnots,
  type HourlyForecast,
  type Spot,
  type Verdict,
} from "@windsiren/shared";
import { supabase } from "@/lib/supabase";
import {
  dbRowToSpot,
  fetch3DayForecast,
  formatDayLabel,
  formatHourLabel,
  groupHoursByLocalDay,
  type DayGroup,
} from "@windsiren/core";

export const dynamic = "force-dynamic";

export default async function SpotDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const { data: row, error } = await supabase
    .from("spots")
    .select("*")
    .eq("slug", slug)
    .eq("active", true)
    .maybeSingle();

  if (error) {
    return <ErrorCard title="Failed to load spot" message={error.message} />;
  }
  if (!row) {
    notFound();
  }

  const spot = dbRowToSpot(row);

  let hours: HourlyForecast[] = [];
  let forecastError: string | null = null;
  try {
    hours = await fetch3DayForecast(spot);
  } catch (e) {
    forecastError = e instanceof Error ? e.message : String(e);
  }

  const days = groupHoursByLocalDay(hours).slice(0, 3);

  return (
    <main className="mx-auto max-w-4xl px-6 py-12">
      <Link
        href="/"
        className="text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
      >
        ← All spots
      </Link>

      <header className="mt-4 mb-10">
        <div className="flex items-center gap-3">
          <h1 className="text-4xl font-bold tracking-tight">{spot.name}</h1>
          {spot.tideSensitive ? (
            <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-950 dark:text-blue-300">
              Tide sensitive
            </span>
          ) : null}
        </div>
        <p className="mt-1 text-sm text-zinc-500">
          {spot.lat.toFixed(5)}°N, {spot.lng.toFixed(5)}°E · Netherlands
        </p>
        <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">
          Evaluated with <span className="font-medium">intermediate</span> profile. Safe wind
          directions:{" "}
          <span className="font-mono">
            {spot.safeWindDirections.map((r) => `${r.from}°–${r.to}°`).join(", ")}
          </span>
        </p>
        {spot.hazards ? (
          <p className="mt-2 text-sm text-amber-700 dark:text-amber-400">⚠ {spot.hazards}</p>
        ) : null}
      </header>

      {forecastError ? (
        <ErrorCard title="Forecast unavailable" message={forecastError} />
      ) : days.length === 0 ? (
        <p className="text-zinc-500">No forecast data available.</p>
      ) : (
        <div className="space-y-10">
          {days.map((day) => (
            <DaySection key={day.dateKey} spot={spot} day={day} />
          ))}
        </div>
      )}
    </main>
  );
}

function DaySection({ spot, day }: { spot: Spot; day: DayGroup }) {
  const verdict = evaluateDay({ spot, hours: day.hours, thresholds: INTERMEDIATE_THRESHOLDS });
  const rideableCount = day.hours.filter((h) => isHourRideable(h, spot, INTERMEDIATE_THRESHOLDS))
    .length;

  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">{formatDayLabel(day.dateKey)}</h2>
          <p className="mt-0.5 text-xs text-zinc-500">
            {rideableCount} rideable {rideableCount === 1 ? "hour" : "hours"}
          </p>
        </div>
        <VerdictBadge verdict={verdict} />
      </div>

      <div className="overflow-x-auto rounded-md border border-zinc-200 dark:border-zinc-800">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 text-left text-xs uppercase text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400">
            <tr>
              <th className="px-3 py-2 font-medium">Time</th>
              <th className="px-3 py-2 font-medium">Wind</th>
              <th className="px-3 py-2 font-medium">Gust</th>
              <th className="px-3 py-2 font-medium">Dir</th>
              <th className="px-3 py-2 font-medium">Air</th>
              <th className="px-3 py-2 font-medium">Rain</th>
              <th className="px-3 py-2 text-right font-medium">Ride</th>
            </tr>
          </thead>
          <tbody>
            {day.hours.map((h) => (
              <HourRow key={h.time} hour={h} spot={spot} />
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function HourRow({ hour, spot }: { hour: HourlyForecast; spot: Spot }) {
  const rideable = isHourRideable(hour, spot, INTERMEDIATE_THRESHOLDS);
  return (
    <tr className="border-t border-zinc-100 dark:border-zinc-800">
      <td className="px-3 py-2 font-mono text-xs">{formatHourLabel(hour.time)}</td>
      <td className="px-3 py-2 font-mono">{msToKnots(hour.windSpeedMs).toFixed(0)} kn</td>
      <td className="px-3 py-2 font-mono text-zinc-500">
        {msToKnots(hour.gustMs).toFixed(0)} kn
      </td>
      <td className="px-3 py-2 text-xs">
        {cardinalDirection(hour.windDirectionDeg)}{" "}
        <span className="text-zinc-400">({Math.round(hour.windDirectionDeg)}°)</span>
      </td>
      <td className="px-3 py-2 font-mono text-xs">{hour.airTempC.toFixed(0)}°C</td>
      <td className="px-3 py-2 font-mono text-xs text-zinc-500">
        {hour.precipitationMm > 0 ? `${hour.precipitationMm.toFixed(1)} mm` : "—"}
      </td>
      <td className="px-3 py-2 text-right">
        {rideable ? (
          <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" aria-label="rideable" />
        ) : (
          <span className="inline-block h-2 w-2 rounded-full bg-zinc-300 dark:bg-zinc-700" aria-label="not rideable" />
        )}
      </td>
    </tr>
  );
}

function VerdictBadge({ verdict }: { verdict: Verdict }) {
  const styles: Record<typeof verdict.decision, string> = {
    go: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
    marginal: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
    no_go: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
  };
  const labels: Record<typeof verdict.decision, string> = {
    go: "GO",
    marginal: "MAYBE",
    no_go: "NO GO",
  };
  return (
    <span
      className={`rounded-full px-3 py-1 text-xs font-bold tracking-wide ${styles[verdict.decision]}`}
    >
      {labels[verdict.decision]}
    </span>
  );
}

function ErrorCard({ title, message }: { title: string; message: string }) {
  return (
    <div className="rounded-md border border-red-300 bg-red-50 p-4 text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
      <p className="font-medium">{title}</p>
      <p className="mt-1 text-sm">{message}</p>
    </div>
  );
}
