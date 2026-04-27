import Link from "next/link";
import { notFound } from "next/navigation";
import {
  cardinalDirection,
  msToKnots,
  type HourlyForecast,
} from "@windsiren/shared";
import { supabase } from "@/lib/supabase";
import {
  dbRowToSpot,
  fetchDailyTides,
  fetchLiveObservation,
  fetchSpotWeek,
  type LiveObservation,
} from "@windsiren/core";
import { SpotConditionsBlock } from "@/components/SpotConditionsBlock";
import { WindguruDayTable } from "@/components/WindguruDayTable";
import { FavoriteButton } from "./FavoriteButton";
import { HomeSpotButton } from "./HomeSpotButton";
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

  // Fetch a full 14-day partition + live observation in parallel. The
  // SpotConditionsBlock pivots through the first ~7 days; the
  // continuous forecast table below scrolls across the full 14.
  // Live-observation failure is non-fatal (returns null).
  const knmiKey = process.env.NEXT_PUBLIC_KNMI_API_KEY;
  const [spotWeek, liveObservation] = await Promise.all([
    fetchSpotWeek(spot, 16),
    fetchLiveObservation(spot, knmiKey),
  ]);

  const allHours: HourlyForecast[] = spotWeek.days.flatMap((d) => d.hours);
  const forecastError = spotWeek.days.length === 0 ? "No forecast data" : null;
  const todayKey = nlLocalDateKey(new Date());

  // Tide events for tide-sensitive spots — fetched for every day in
  // the forecast window so the weather table can render a continuous
  // tide curve. Insensitive spots return [] and the row hides itself.
  const tideDays = spotWeek.days.map((d) => d.dateKey);
  const tidesPerDay = await Promise.all(
    tideDays.map((dateKey) => fetchDailyTides(spot, dateKey)),
  );
  const tideEvents = tidesPerDay.flat();

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
          <div className="flex flex-col items-end gap-2">
            <HomeSpotButton spotId={spot.id} />
            <FavoriteButton spotId={spot.id} />
          </div>
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

      {spotWeek.days.length > 0 ? (
        <section className="mb-10">
          <SpotConditionsBlock spotWeek={spotWeek} todayKey={todayKey} />
        </section>
      ) : null}

      {forecastError ? (
        <ErrorCard title="Forecast unavailable" message={forecastError} />
      ) : (
        <section className="mb-10">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-zinc-500">
            Forecast — next {spotWeek.days.length} days
          </h2>
          <WindguruDayTable
            spot={spot}
            hours={allHours}
            tideEvents={tideEvents}
          />
        </section>
      )}

      <SpotSocial spot={spot} />
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


function nlLocalDateKey(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Amsterdam",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

function ErrorCard({ title, message }: { title: string; message: string }) {
  return (
    <div className="rounded-md border border-red-300 bg-red-50 p-4 text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
      <p className="font-medium">{title}</p>
      <p className="mt-1 text-sm">{message}</p>
    </div>
  );
}
