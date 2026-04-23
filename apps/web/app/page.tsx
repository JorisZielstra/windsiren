import { supabase } from "@/lib/supabase";
import { dbRowToSpot, fetchTodayVerdict, peakWindMs } from "@/lib/spots";
import { msToKnots } from "@windsiren/shared";

// Dynamic because we fetch live forecasts on every request.
// TODO: add `next.revalidate = 300` after we're sure the UX works, for 5-min caching.
export const dynamic = "force-dynamic";

export default async function Home() {
  const { data: rows, error } = await supabase
    .from("spots")
    .select("*")
    .eq("active", true)
    .order("name");

  if (error) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-16">
        <h1 className="text-4xl font-bold">WindSiren</h1>
        <div className="mt-6 rounded-md border border-red-300 bg-red-50 p-4 text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
          <p className="font-medium">Failed to load spots</p>
          <p className="mt-1 text-sm">{error.message}</p>
        </div>
      </main>
    );
  }

  const spots = (rows ?? []).map(dbRowToSpot);
  const withVerdicts = await Promise.all(spots.map(fetchTodayVerdict));

  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <header className="mb-8">
        <h1 className="text-4xl font-bold tracking-tight">WindSiren</h1>
        <p className="mt-2 text-zinc-600 dark:text-zinc-400">
          {withVerdicts.length} curated NL kitesurf spots · today&apos;s forecast · intermediate preset
        </p>
      </header>

      <ul className="space-y-2">
        {withVerdicts.map(({ spot, verdict, hours }) => {
          const peak = peakWindMs(hours);
          return (
            <li
              key={spot.id}
              className="flex items-center justify-between rounded-md border border-zinc-200 px-4 py-3 dark:border-zinc-800"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{spot.name}</span>
                  {spot.tideSensitive ? (
                    <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                      Tide
                    </span>
                  ) : null}
                </div>
                <div className="mt-0.5 text-xs text-zinc-500">
                  {spot.lat.toFixed(3)}°N, {spot.lng.toFixed(3)}°E
                  {peak !== null ? (
                    <>
                      {" · "}
                      peak <span className="font-mono">{msToKnots(peak).toFixed(0)} kn</span>
                    </>
                  ) : null}
                </div>
              </div>
              <VerdictBadge verdict={verdict} />
            </li>
          );
        })}
      </ul>
    </main>
  );
}

function VerdictBadge({ verdict }: { verdict: Awaited<ReturnType<typeof fetchTodayVerdict>>["verdict"] }) {
  if (verdict === null) {
    return (
      <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-medium text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
        No data
      </span>
    );
  }
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
