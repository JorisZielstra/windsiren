import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import {
  dbRowToSpot,
  fetchFavoriteSpotIds,
  fetchPersonalFeed,
  fetchTodayVerdict,
  getCommentCounts,
  getLikeCounts,
  getLikedSessionIds,
  getPhotosForSessions,
  getPhotoPublicUrl,
  getPublicProfiles,
  peakWindMs,
  pickHeroSpot,
  type SpotWithVerdict,
} from "@windsiren/core";
import { msToKnots } from "@windsiren/shared";
import { HeroSpotCard } from "@/components/HeroSpotCard";
import { SessionCard } from "@/components/SessionCard";
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
  const withVerdicts = await Promise.all(spots.map(fetchTodayVerdict));

  const favoriteIds = user ? await fetchFavoriteSpotIds(authed, user.id) : new Set<string>();
  const favorites = withVerdicts.filter((item) => favoriteIds.has(item.spot.id));

  const heroPool = favorites.length > 0 ? favorites : withVerdicts;
  const hero = pickHeroSpot(heroPool);

  // Other spots: favorites pinned to the top, then non-favorites — alphabetical within each group.
  const restFavorites = favorites.filter((f) => f.spot.id !== hero?.spot.id);
  const restNonFavorites = withVerdicts.filter(
    (item) => item.spot.id !== hero?.spot.id && !favoriteIds.has(item.spot.id),
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
      {hero ? (
        <section className="mb-8">
          <HeroSpotCard item={hero} />
        </section>
      ) : null}

      <details className="mb-10 rounded-lg border border-zinc-200 dark:border-zinc-800">
        <summary className="cursor-pointer list-none px-4 py-3 text-sm font-medium [&::-webkit-details-marker]:hidden">
          <span className="mr-2 text-zinc-400 transition-transform group-open:rotate-90">▸</span>
          Other spots ({restFavorites.length + restNonFavorites.length})
        </summary>
        <div className="border-t border-zinc-100 px-4 pb-4 pt-2 dark:border-zinc-900">
          {restFavorites.length > 0 ? (
            <>
              <h3 className="mb-2 mt-1 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                Your spots
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
              <h3 className="mb-2 mt-4 text-xs font-semibold uppercase tracking-wide text-zinc-500">
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
            <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
              Your feed
            </h2>
            <Link href="/feed" className="text-xs text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100">
              View all →
            </Link>
          </div>
          {feedItems.length === 0 ? (
            <div className="rounded-md border border-zinc-200 p-6 text-sm text-zinc-500 dark:border-zinc-800">
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
                    className="rounded-md border border-zinc-200 px-4 py-3 dark:border-zinc-800"
                  >
                    <div className="flex items-center justify-between gap-2 text-sm">
                      <span>
                        <Link
                          href={`/users/${item.userId}`}
                          className="font-medium hover:underline"
                        >
                          {authorName}
                        </Link>{" "}
                        is going to{" "}
                        {spot ? (
                          <Link href={`/spots/${spot.slug}`} className="font-medium hover:underline">
                            {spot.name}
                          </Link>
                        ) : (
                          "Unknown spot"
                        )}{" "}
                        on{" "}
                        <span className="font-medium">
                          {new Date(r.planned_date).toLocaleDateString("en-NL", {
                            weekday: "long",
                            month: "short",
                            day: "numeric",
                          })}
                        </span>
                      </span>
                      <span className="text-xs text-zinc-500">{relativeTime(item.createdAt)}</span>
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
    <li className="flex items-center justify-between rounded-md border border-zinc-200 px-4 py-3 transition-colors hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:border-zinc-700 dark:hover:bg-zinc-900">
      <Link href={`/spots/${item.spot.slug}`} className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="font-medium">{item.spot.name}</span>
          {item.spot.tideSensitive ? (
            <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-950 dark:text-blue-300">
              Tide
            </span>
          ) : null}
        </div>
        <div className="mt-0.5 text-xs text-zinc-500">
          {item.spot.lat.toFixed(3)}°N, {item.spot.lng.toFixed(3)}°E
          {peak !== null ? (
            <>
              {" · "}
              peak <span className="font-mono">{msToKnots(peak).toFixed(0)} kn</span>
            </>
          ) : null}
        </div>
      </Link>
      <VerdictBadge verdict={item.verdict} />
    </li>
  );
}

function VerdictBadge({ verdict }: { verdict: SpotWithVerdict["verdict"] }) {
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
