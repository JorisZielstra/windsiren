import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import {
  dbRowToSpot,
  fetchFavoriteSpotIds,
  fetchHomeSpotIds,
  fetchPersonalFeed,
  fetchSpotWeek,
  getCommentCounts,
  getFriendsOnWaterToday,
  getLikeCounts,
  getLikedSessionIds,
  getPhotosForSessions,
  getPhotoPublicUrl,
  getPublicProfiles,
  getUserPrefs,
  peakWindMs,
  pickHeroSpot,
  prefsToThresholds,
  type SpotWeek,
  type SpotWithVerdict,
} from "@windsiren/core";
import { msToKnots } from "@windsiren/shared";
import { SessionCard } from "@/components/SessionCard";
import { TodayDashboard } from "@/components/TodayDashboard";
import { VerdictBadge } from "@/components/VerdictBadge";
import { relativeTime } from "@/lib/relative-time";

export const dynamic = "force-dynamic";

export default async function Home() {
  const authed = await createSupabaseServerClient();
  const {
    data: { user },
  } = await authed.auth.getUser();

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
  // Resolve the viewer's personal kite-condition thresholds (or the
  // shared defaults when signed out / unset). Same profile drives every
  // verdict on this page so the headline + collapsible + week strip
  // agree on what counts as GO.
  const userPrefs = await getUserPrefs(authed, user?.id ?? null);
  const userThresholds = prefsToThresholds(userPrefs);
  // 16 days = Open-Meteo's free-tier max. Lets the WeekStrip carousel
  // show this week + ~2 weeks of future data.
  const spotWeeks = await Promise.all(
    spots.map((s) => fetchSpotWeek(s, 16, userThresholds)),
  );

  const todayKey = nlLocalDateKey(new Date());

  // Today's verdicts derived from the partitioned week (no extra fetch).
  const withVerdicts: SpotWithVerdict[] = spotWeeks.map((week) => {
    const today = week.days.find((d) => d.dateKey === todayKey) ?? week.days[0];
    return {
      spot: week.spot,
      verdict: today?.verdict ?? null,
      hours: today?.hours ?? [],
    };
  });

  const [favoriteIds, homeSpotIds, friendsToday] = await Promise.all([
    user ? fetchFavoriteSpotIds(authed, user.id) : Promise.resolve(new Set<string>()),
    user ? fetchHomeSpotIds(authed, user.id) : Promise.resolve(new Set<string>()),
    user
      ? getFriendsOnWaterToday(authed, user.id, todayKey)
      : Promise.resolve({ count: 0, profiles: [] }),
  ]);
  // The dashboard's "Best:" anchor is the top spot across all NL — the
  // collapsible below pins home spots and favorites separately.
  const bestSpot = pickHeroSpot(withVerdicts);

  // Other spots, in priority order. A spot only appears once: home > favorite > rest.
  // This keeps the user's most relevant spots at the top regardless of name —
  // otherwise "Andijk" wins by alphabet every time.
  const restHomeSpots = withVerdicts.filter(
    (item) => item.spot.id !== bestSpot?.spot.id && homeSpotIds.has(item.spot.id),
  );
  const restFavorites = withVerdicts.filter(
    (item) =>
      item.spot.id !== bestSpot?.spot.id &&
      favoriteIds.has(item.spot.id) &&
      !homeSpotIds.has(item.spot.id),
  );
  const restNonFavorites = withVerdicts.filter(
    (item) =>
      item.spot.id !== bestSpot?.spot.id &&
      !favoriteIds.has(item.spot.id) &&
      !homeSpotIds.has(item.spot.id),
  );


  // Personal feed (signed-in only) — top 5 items, with a link to the full feed.
  const feedItems = user
    ? await fetchPersonalFeed(authed, user.id, { limit: 5, includeSelf: true })
    : [];
  const feedSessionIds = feedItems.filter((i) => i.type === "session").map((i) => i.session.id);
  const feedAuthorIds = Array.from(new Set(feedItems.map((i) => i.userId)));
  const feedSpotIds = Array.from(new Set(feedItems.map((i) => i.spotId)));

  const [feedProfiles, feedSpotRes, feedLikeCounts, feedLikedSet, feedPhotos, feedCommentCounts] =
    user && feedItems.length > 0
      ? await Promise.all([
          getPublicProfiles(authed, feedAuthorIds),
          feedSpotIds.length > 0
            ? authed.from("spots").select("id, name, slug").in("id", feedSpotIds)
            : Promise.resolve({ data: [] as { id: string; name: string; slug: string }[] }),
          getLikeCounts(authed, feedSessionIds),
          getLikedSessionIds(authed, user.id, feedSessionIds),
          getPhotosForSessions(authed, feedSessionIds),
          getCommentCounts(authed, feedSessionIds),
        ])
      : await Promise.all([
          Promise.resolve(new Map()),
          Promise.resolve({ data: [] as { id: string; name: string; slug: string }[] }),
          Promise.resolve(new Map<string, number>()),
          Promise.resolve(new Set<string>()),
          getPhotosForSessions(authed, []),
          Promise.resolve(new Map<string, number>()),
        ]);
  const feedSpotMap = new Map<string, { name: string; slug: string }>();
  for (const s of feedSpotRes.data ?? [])
    feedSpotMap.set(s.id, { name: s.name, slug: s.slug });
  const feedPhotoUrls = new Map<string, string[]>();
  for (const [sid, photos] of feedPhotos) {
    feedPhotoUrls.set(
      sid,
      photos.map((p) => getPhotoPublicUrl(authed, p.storage_path)),
    );
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <section className="mb-8">
        <TodayDashboard
          spotWeeks={spotWeeks}
          todayKey={todayKey}
          friendsCount={friendsToday.count}
          friendsPreview={friendsToday.profiles}
          signedIn={!!user}
          homeSpotIds={homeSpotIds}
          prefsSummary={summarizePrefs(userPrefs)}
        />
      </section>

      <details className="group mb-10 rounded-2xl border border-border bg-paper-2 shadow-sm">
        <summary className="cursor-pointer list-none px-5 py-3.5 text-sm font-semibold text-ink [&::-webkit-details-marker]:hidden">
          <span className="mr-2 inline-block text-ink-faint transition-transform group-open:rotate-90">
            ▸
          </span>
          Other spots ({restHomeSpots.length + restFavorites.length + restNonFavorites.length})
        </summary>
        <div className="border-t border-border px-5 pb-5 pt-3">
          {restHomeSpots.length > 0 ? (
            <>
              <h3 className="mb-2 mt-1 font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-go-strong">
                🏠 Your home spots
              </h3>
              <ul className="space-y-2">
                {restHomeSpots.map((item) => (
                  <SpotRow key={item.spot.id} item={item} />
                ))}
              </ul>
            </>
          ) : null}
          {restFavorites.length > 0 ? (
            <>
              <h3 className="mb-2 mt-4 font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-ink-mute">
                ★ Favorites
              </h3>
              <ul className="space-y-2">
                {restFavorites.map((item) => (
                  <SpotRow key={item.spot.id} item={item} />
                ))}
              </ul>
            </>
          ) : null}
          {restNonFavorites.length > 0 ? (
            <>
              <h3 className="mb-2 mt-4 font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-ink-mute">
                All NL spots
              </h3>
              <ul className="space-y-2">
                {restNonFavorites.map((item) => (
                  <SpotRow key={item.spot.id} item={item} />
                ))}
              </ul>
            </>
          ) : null}
        </div>
      </details>

      {user ? (
        <section>
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-ink-mute">
              Your feed
            </h2>
            <Link
              href="/feed"
              className="text-xs font-medium text-brand-link hover:underline"
            >
              View all →
            </Link>
          </div>
          {feedItems.length === 0 ? (
            <div className="rounded-xl border border-border bg-paper-2 p-6 text-sm text-ink-mute">
              Nothing yet. Follow other kiters on a spot page, or log a session to get the feed going.
            </div>
          ) : (
            <ul className="space-y-3">
              {feedItems.map((item) => {
                const authorName = feedProfiles.get(item.userId)?.display_name ?? "Someone";
                const spot = feedSpotMap.get(item.spotId) ?? null;
                if (item.type === "session") {
                  return (
                    <SessionCard
                      key={`s:${item.session.id}`}
                      session={item.session}
                      authorId={item.userId}
                      authorName={authorName}
                      spot={spot}
                      createdAtRelative={relativeTime(item.createdAt)}
                      photoUrls={feedPhotoUrls.get(item.session.id) ?? []}
                      likeCount={feedLikeCounts.get(item.session.id) ?? 0}
                      liked={feedLikedSet.has(item.session.id)}
                      commentCount={feedCommentCounts.get(item.session.id) ?? 0}
                      viewerId={user.id}
                    />
                  );
                }
                const r = item.rsvp;
                return (
                  <li
                    key={`r:${r.id}`}
                    className="rounded-xl border border-border bg-paper-2 px-4 py-3"
                  >
                    <div className="flex items-center justify-between gap-2 text-sm">
                      <span className="text-ink-2">
                        <Link
                          href={`/users/${item.userId}`}
                          className="font-semibold text-ink hover:underline"
                        >
                          {authorName}
                        </Link>{" "}
                        is going to{" "}
                        {spot ? (
                          <Link
                            href={`/spots/${spot.slug}`}
                            className="font-semibold text-brand-link hover:underline"
                          >
                            {spot.name}
                          </Link>
                        ) : (
                          "Unknown spot"
                        )}{" "}
                        on{" "}
                        <span className="font-semibold text-ink">
                          {new Date(r.planned_date).toLocaleDateString("en-NL", {
                            weekday: "long",
                            month: "short",
                            day: "numeric",
                          })}
                        </span>
                      </span>
                      <span className="text-xs text-ink-mute">
                        {relativeTime(item.createdAt)}
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      ) : null}
    </main>
  );
}

function SpotRow({ item }: { item: SpotWithVerdict }) {
  const peak = peakWindMs(item.hours);
  return (
    <li className="flex items-center justify-between rounded-lg border border-border bg-paper px-4 py-3 transition-colors hover:border-border-strong hover:bg-paper-sunk">
      <Link href={`/spots/${item.spot.slug}`} className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-ink">{item.spot.name}</span>
          {item.spot.tideSensitive ? (
            <span className="rounded-full bg-brand-soft px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-brand-strong">
              Tide
            </span>
          ) : null}
        </div>
        <div className="mt-0.5 text-xs text-ink-mute">
          <span className="font-mono">
            {item.spot.lat.toFixed(3)}°N, {item.spot.lng.toFixed(3)}°E
          </span>
          {peak !== null ? (
            <>
              {" · "}
              peak{" "}
              <span className="font-mono font-semibold text-ink-2">
                {msToKnots(peak).toFixed(0)} kn
              </span>
            </>
          ) : null}
        </div>
      </Link>
      <VerdictBadge verdict={item.verdict} />
    </li>
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

// Tiny one-line read of the user's GO threshold for the dashboard. Only
// renders constraints that are actually set so it doesn't get noisy.
function summarizePrefs(prefs: {
  minWindKn: number;
  maxGustKn: number | null;
  minAirTempC: number | null;
  minWaterTempC: number | null;
}): string {
  const parts: string[] = [`min ${prefs.minWindKn} kn`];
  if (prefs.maxGustKn !== null) parts.push(`gust ≤ ${prefs.maxGustKn}`);
  if (prefs.minAirTempC !== null) parts.push(`air ≥ ${prefs.minAirTempC}°C`);
  if (prefs.minWaterTempC !== null) parts.push(`water ≥ ${prefs.minWaterTempC}°C`);
  return parts.join(" · ");
}
