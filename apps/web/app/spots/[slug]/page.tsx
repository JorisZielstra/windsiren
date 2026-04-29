import Link from "next/link";
import { notFound } from "next/navigation";
import { type HourlyForecast } from "@windsiren/shared";
import { supabase } from "@/lib/supabase";
import {
  dbRowToSpot,
  fetchDailyTides,
  fetchLiveObservation,
  fetchSpotWeek,
  getUserPrefs,
  prefsToThresholds,
} from "@windsiren/core";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { CollapsibleSection } from "@/components/CollapsibleSection";
import { LiveObservationCard } from "@/components/LiveObservationCard";
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

  // Resolve user prefs first so verdicts on this page reflect their
  // personal min-wind / gust / temp thresholds (or the shared defaults
  // when signed out).
  const authed = await createSupabaseServerClient();
  const {
    data: { user },
  } = await authed.auth.getUser();
  const userPrefs = await getUserPrefs(authed, user?.id ?? null);
  const userThresholds = prefsToThresholds(userPrefs);

  // Fetch a full 14-day partition + live observation in parallel. The
  // SpotConditionsBlock pivots through the first ~7 days; the
  // continuous forecast table below scrolls across the full 14.
  // Live-observation failure is non-fatal (returns null).
  const knmiKey = process.env.NEXT_PUBLIC_KNMI_API_KEY;
  const [spotWeek, liveObservation] = await Promise.all([
    fetchSpotWeek(spot, 16, userThresholds),
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
        className="text-sm text-ink-mute hover:text-ink"
      >
        ← All spots
      </Link>

      <header className="mt-4 mb-10">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="headline text-5xl text-ink">{spot.name}</h1>
              {spot.tideSensitive ? (
                <span className="rounded-full bg-brand-soft px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-brand-strong">
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
        <p className="mt-2 font-mono text-xs text-ink-mute">
          {spot.lat.toFixed(5)}°N, {spot.lng.toFixed(5)}°E · NETHERLANDS
        </p>

        <div className="mt-5 flex items-center gap-4">
          <WindRose
            safeDirections={spot.safeWindDirections}
            currentWindDirectionDeg={liveObservation?.observation.windDirectionDeg ?? null}
            size={120}
          />
          <div className="text-sm text-ink-2">
            <p>
              <span className="inline-block h-2 w-2 translate-y-[-1px] rounded-sm bg-go/60" />{" "}
              Safe wind arc
            </p>
            {liveObservation ? (
              <p className="mt-1">
                <span className="inline-block h-2 w-2 translate-y-[-1px] rounded-full bg-brand" />{" "}
                Current wind ({Math.round(liveObservation.observation.windDirectionDeg)}°)
              </p>
            ) : null}
            <p className="mt-1 font-mono text-xs text-ink-mute">
              {spot.safeWindDirections.map((r) => `${r.from}°–${r.to}°`).join(", ")}
            </p>
          </div>
        </div>

      </header>

      {/* Three weather panels stacked into one card with internal dividers.
          Each panel is independently collapsible — kiters can hide the
          ones they don't want. Default open. */}
      <section className="mb-10 overflow-hidden rounded-2xl border border-border bg-paper-2 shadow-[0_1px_2px_rgba(11,46,63,0.04),0_8px_24px_-12px_rgba(11,46,63,0.12)]">
        {liveObservation ? (
          <LiveObservationCard live={liveObservation} spot={spot} />
        ) : null}
        {spotWeek.days.length > 0 ? (
          <CollapsibleSection
            title={`Conditions for ${spot.name}`}
            subtitle="Tap a day to pivot · tap a tile for hourly chart"
            flush
          >
            <SpotConditionsBlock
              spotWeek={spotWeek}
              todayKey={todayKey}
              flush
              headless
            />
          </CollapsibleSection>
        ) : null}
        {forecastError ? (
          <div className="border-t border-border px-4 py-4">
            <ErrorCard title="Forecast unavailable" message={forecastError} />
          </div>
        ) : (
          <CollapsibleSection
            title={`Forecast — next ${spotWeek.days.length} days`}
            flush
          >
            <WindguruDayTable
              spot={spot}
              hours={allHours}
              tideEvents={tideEvents}
              flush
            />
          </CollapsibleSection>
        )}
      </section>

      <SpotSocial spot={spot} />
    </main>
  );
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
    <div className="rounded-lg border border-hazard/30 bg-hazard-soft p-4 text-hazard">
      <p className="font-semibold">{title}</p>
      <p className="mt-1 text-sm">{message}</p>
    </div>
  );
}
