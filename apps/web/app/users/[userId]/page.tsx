import Link from "next/link";
import { notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import {
  getCommentCounts,
  getFollowCounts,
  getLikeCounts,
  getLikedSessionIds,
  getPhotosForSessions,
  getPhotoPublicUrl,
  getPublicProfile,
  getUserStats,
  listSessionsForUser,
  listUserRsvps,
} from "@windsiren/core";
import { Avatar } from "@/components/Avatar";
import { SessionCard } from "@/components/SessionCard";
import { UserStatsPanel } from "@/components/UserStatsPanel";
import { relativeTime } from "@/lib/relative-time";
import { FollowButton } from "./FollowButton";

export const dynamic = "force-dynamic";

export default async function UserProfilePage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const { userId } = await params;
  const supabase = await createSupabaseServerClient();

  const [profile, counts, sessions, rsvps, stats] = await Promise.all([
    getPublicProfile(supabase, userId),
    getFollowCounts(supabase, userId),
    listSessionsForUser(supabase, userId, 20),
    listUserRsvps(supabase, userId, 20),
    getUserStats(supabase, userId),
  ]);

  if (!profile) notFound();

  // Resolve spot names for sessions + rsvps + top-spot stat in one query.
  const spotIds = Array.from(
    new Set([
      ...sessions.map((s) => s.spot_id),
      ...rsvps.map((r) => r.spot_id),
      ...(stats.topSpot ? [stats.topSpot.spotId] : []),
    ]),
  );
  const spotMap = new Map<string, { name: string; slug: string }>();
  if (spotIds.length > 0) {
    const { data: spotRows } = await supabase
      .from("spots")
      .select("id, name, slug")
      .in("id", spotIds);
    for (const s of spotRows ?? []) spotMap.set(s.id, { name: s.name, slug: s.slug });
  }

  // Photos / likes / comments per session — needed by SessionCard.
  const sessionIds = sessions.map((s) => s.id);
  const {
    data: { user: viewer },
  } = await supabase.auth.getUser();
  const [photosBySession, likeCounts, likedSet, commentCounts] = await Promise.all([
    getPhotosForSessions(supabase, sessionIds),
    getLikeCounts(supabase, sessionIds),
    viewer
      ? getLikedSessionIds(supabase, viewer.id, sessionIds)
      : Promise.resolve(new Set<string>()),
    getCommentCounts(supabase, sessionIds),
  ]);
  const photoUrlsBySession = new Map<string, string[]>();
  for (const [sid, photos] of photosBySession) {
    photoUrlsBySession.set(
      sid,
      photos.map((p) => getPhotoPublicUrl(supabase, p.storage_path)),
    );
  }

  // Filter RSVPs to today-and-future (upcoming)
  const today = new Date().toISOString().slice(0, 10);
  const upcomingRsvps = rsvps.filter((r) => r.planned_date >= today);

  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <Link
        href="/"
        className="text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
      >
        ← Home
      </Link>

      <header className="mt-4 mb-10">
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 flex-1 items-start gap-4">
            <Avatar url={profile.avatar_url} name={profile.display_name} />
            <div className="min-w-0 flex-1">
              <h1 className="text-3xl font-bold tracking-tight">
                {profile.display_name ?? "Anonymous kiter"}
              </h1>
              {profile.bio ? (
                <p className="mt-2 text-zinc-700 dark:text-zinc-300">{profile.bio}</p>
              ) : null}
              <p className="mt-3 text-sm text-zinc-500">
                <span className="font-medium text-zinc-900 dark:text-zinc-100">
                  {counts.followers}
                </span>{" "}
                follower{counts.followers === 1 ? "" : "s"} ·{" "}
                <span className="font-medium text-zinc-900 dark:text-zinc-100">
                  {counts.following}
                </span>{" "}
                following
              </p>
            </div>
          </div>
          <FollowButton targetUserId={userId} />
        </div>
      </header>

      <section className="mb-10">
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-zinc-500">
          Stats
        </h2>
        <UserStatsPanel
          stats={stats}
          topSpotName={stats.topSpot ? spotMap.get(stats.topSpot.spotId)?.name ?? null : null}
          topSpotSlug={stats.topSpot ? spotMap.get(stats.topSpot.spotId)?.slug ?? null : null}
        />
      </section>

      <section className="mb-10">
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-zinc-500">
          Upcoming RSVPs
        </h2>
        {upcomingRsvps.length === 0 ? (
          <p className="text-sm text-zinc-500">No upcoming plans.</p>
        ) : (
          <ul className="space-y-2">
            {upcomingRsvps.map((r) => {
              const spot = spotMap.get(r.spot_id);
              return (
                <li
                  key={r.id}
                  className="flex items-center justify-between rounded-md border border-zinc-200 px-4 py-3 dark:border-zinc-800"
                >
                  <div>
                    <div className="font-medium">
                      {spot ? (
                        <Link href={`/spots/${spot.slug}`} className="hover:underline">
                          {spot.name}
                        </Link>
                      ) : (
                        "Unknown spot"
                      )}
                    </div>
                    <div className="mt-0.5 text-xs text-zinc-500">
                      {new Date(r.planned_date).toLocaleDateString("en-NL", {
                        weekday: "long",
                        month: "short",
                        day: "numeric",
                      })}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-zinc-500">
          Recent sessions
        </h2>
        {sessions.length === 0 ? (
          <p className="text-sm text-zinc-500">No sessions logged yet.</p>
        ) : (
          <ul className="space-y-3">
            {sessions.map((s) => {
              const spot = spotMap.get(s.spot_id) ?? null;
              return (
                <SessionCard
                  key={s.id}
                  session={s}
                  authorId={s.user_id}
                  authorName={profile.display_name ?? "Someone"}
                  spot={spot}
                  showAuthor={false}
                  createdAtRelative={relativeTime(s.created_at)}
                  photoUrls={photoUrlsBySession.get(s.id) ?? []}
                  likeCount={likeCounts.get(s.id) ?? 0}
                  liked={likedSet.has(s.id)}
                  commentCount={commentCounts.get(s.id) ?? 0}
                  viewerId={viewer?.id}
                />
              );
            })}
          </ul>
        )}
      </section>
    </main>
  );
}
