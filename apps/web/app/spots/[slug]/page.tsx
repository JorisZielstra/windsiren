import Link from "next/link";
import { notFound } from "next/navigation";
import {
  cardinalDirection,
  evaluateDay,
  DEFAULT_THRESHOLDS,
  isHourRideable,
  msToKnots,
  type HourlyForecast,
  type Spot,
  type TidePoint,
  type Verdict,
} from "@windsiren/shared";
import { supabase } from "@/lib/supabase";
import {
  dbRowToSpot,
  fetch3DayForecast,
  fetchDailyTides,
  fetchLiveObservation,
  formatDayLabel,
  formatHourLabel,
  groupHoursByLocalDay,
  type DayGroup,
  type LiveObservation,
} from "@windsiren/core";
import { FavoriteButton } from "./FavoriteButton";
import { SpotSocial } from "./SpotSocial";
import { WindRose } from "./WindRose";

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

  // Fetch forecast + live observation in parallel; live-observation failure
  // is non-fatal and handled inside the helper (returns null).
  const knmiKey = process.env.NEXT_PUBLIC_KNMI_API_KEY;
  const [forecastResult, liveObservation] = await Promise.all([
    fetch3DayForecast(spot).then(
      (hours) => ({ ok: true as const, hours }),
      (err) => ({ ok: false as const, error: err instanceof Error ? err.message : String(err) }),
    ),
    fetchLiveObservation(spot, knmiKey),
  ]);

  const hours: HourlyForecast[] = forecastResult.ok ? forecastResult.hours : [];
  const forecastError = forecastResult.ok ? null : forecastResult.error;
  const days = groupHoursByLocalDay(hours).slice(0, 3);

  // Once we know the three local-date keys, fetch tide events for each in parallel.
  const tidesPerDay = await Promise.all(days.map((d) => fetchDailyTides(spot, d.dateKey)));

  return (
    <main className="mx-auto max-w-4xl px-6 py-12">
      <Link
        href="/"
        className="text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
      >
        ← All spots
      </Link>

      <header className="mt-4 mb-10">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-4xl font-bold tracking-tight">{spot.name}</h1>
              {spot.tideSensitive ? (
                <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                  Tide sensitive
                </span>
              ) : null}
            </div>
          </div>
          <FavoriteButton spotId={spot.id} />
        </div>
        <p className="mt-1 text-sm text-zinc-500">
          {spot.lat.toFixed(5)}°N, {spot.lng.toFixed(5)}°E · Netherlands
        </p>

        <div className="mt-4 flex items-center gap-4">
          <WindRose
            safeDirections={spot.safeWindDirections}
            currentWindDirectionDeg={liveObservation?.observation.windDirectionDeg ?? null}
            size={120}
          />
          <div className="text-sm text-zinc-600 dark:text-zinc-400">
            <p>
              <span className="inline-block h-2 w-2 translate-y-[-1px] rounded-sm bg-emerald-400/80 dark:bg-emerald-800" />{" "}
              Safe wind arc
            </p>
            {liveObservation ? (
              <p className="mt-1">
                <span className="inline-block h-2 w-2 translate-y-[-1px] rounded-full bg-sky-600 dark:bg-sky-400" />{" "}
                Current wind ({Math.round(liveObservation.observation.windDirectionDeg)}°)
              </p>
            ) : null}
            <p className="mt-1 font-mono text-xs text-zinc-500">
              {spot.safeWindDirections.map((r) => `${r.from}°–${r.to}°`).join(", ")}
            </p>
          </div>
        </div>

        {spot.hazards ? (
          <p className="mt-4 text-sm text-amber-700 dark:text-amber-400">⚠ {spot.hazards}</p>
        ) : null}
      </header>

      {liveObservation ? <LivePanel live={liveObservation} /> : null}

      {forecastError ? (
        <ErrorCard title="Forecast unavailable" message={forecastError} />
      ) : days.length === 0 ? (
        <p className="text-zinc-500">No forecast data available.</p>
      ) : (
        <div className="space-y-10">
          {days.map((day, i) => (
            <DaySection
              key={day.dateKey}
              spot={spot}
              day={day}
              tides={tidesPerDay[i] ?? []}
            />
          ))}
        </div>
      )}

      <SpotSocial spotId={spot.id} />
    </main>
  );
}

function LivePanel({ live }: { live: LiveObservation }) {
  const { observation: o, ageMinutes } = live;
  const stale = ageMinutes > 20; // KNMI publishes every 10 min; 20+ min = something's off
  return (
    <section className="mb-8 rounded-lg border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
          Live — KNMI station {o.stationId}
        </h2>
        <span className={`text-xs ${stale ? "text-amber-600 dark:text-amber-400" : "text-zinc-500"}`}>
          {ageMinutes === 0 ? "just now" : `${ageMinutes} min ago`}
          {stale ? " · stale" : ""}
        </span>
      </div>
      <div className="flex flex-wrap gap-6">
        <Stat label="Wind" value={`${msToKn(o.windSpeedMs)} kn`} sub={cardinalDirection(o.windDirectionDeg)} />
        <Stat label="Gust" value={`${msToKn(o.gustMs)} kn`} />
        <Stat label="Dir" value={`${Math.round(o.windDirectionDeg)}°`} />
        {o.airTempC !== null ? <Stat label="Air" value={`${o.airTempC.toFixed(0)}°C`} /> : null}
        {o.pressureHpa !== null ? (
          <Stat label="Pressure" value={`${o.pressureHpa.toFixed(0)} hPa`} />
        ) : null}
      </div>
    </section>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-zinc-500">{label}</div>
      <div className="mt-0.5 flex items-baseline gap-1">
        <span className="font-mono text-xl font-semibold">{value}</span>
        {sub ? <span className="text-xs text-zinc-500">{sub}</span> : null}
      </div>
    </div>
  );
}

function msToKn(ms: number): string {
  return msToKnots(ms).toFixed(0);
}

function DaySection({
  spot,
  day,
  tides,
}: {
  spot: Spot;
  day: DayGroup;
  tides: TidePoint[];
}) {
  const verdict = evaluateDay({ spot, hours: day.hours, thresholds: DEFAULT_THRESHOLDS });
  const rideableCount = day.hours.filter((h) => isHourRideable(h, spot, DEFAULT_THRESHOLDS))
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

      {tides.length > 0 ? <TideRow tides={tides} /> : null}

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
  const rideable = isHourRideable(hour, spot, DEFAULT_THRESHOLDS);
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

function TideRow({ tides }: { tides: TidePoint[] }) {
  return (
    <div className="mb-3 flex flex-wrap gap-3 text-xs text-zinc-600 dark:text-zinc-400">
      {tides.map((t) => (
        <span
          key={t.at}
          className="inline-flex items-center gap-1.5 rounded-md border border-zinc-200 bg-white px-2 py-1 font-mono dark:border-zinc-800 dark:bg-zinc-950"
        >
          <span className={t.type === "high" ? "text-sky-600 dark:text-sky-400" : "text-amber-600 dark:text-amber-400"}>
            {t.type === "high" ? "▲" : "▼"}
          </span>
          <span>{formatHourLabel(t.at)}</span>
          <span className="text-zinc-400">
            {t.heightCm >= 0 ? "+" : ""}
            {t.heightCm} cm
          </span>
        </span>
      ))}
    </div>
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
