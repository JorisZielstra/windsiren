import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getCommentCounts,
  getLikeCounts,
  getLikedSessionIds,
  getPhotosForSessions,
  getPhotoPublicUrl,
  getPublicProfile,
  getSession,
} from "@windsiren/core";
import { CommentSection } from "@/components/CommentSection";
import { LikeButton } from "@/components/LikeButton";
import { PhotoGrid } from "@/components/PhotoGrid";
import { SessionWindHero } from "@/components/SessionWindHero";
import { relativeTime } from "@/lib/relative-time";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

export default async function SessionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();

  const session = await getSession(supabase, id);
  if (!session) notFound();

  const {
    data: { user: viewer },
  } = await supabase.auth.getUser();

  const [author, spotRes, photosBySession, likeCounts, likedSet, commentCounts] =
    await Promise.all([
      getPublicProfile(supabase, session.user_id),
      supabase.from("spots").select("id, name, slug").eq("id", session.spot_id).maybeSingle(),
      getPhotosForSessions(supabase, [session.id]),
      getLikeCounts(supabase, [session.id]),
      viewer
        ? getLikedSessionIds(supabase, viewer.id, [session.id])
        : Promise.resolve(new Set<string>()),
      getCommentCounts(supabase, [session.id]),
    ]);

  const spot = spotRes.data ? { name: spotRes.data.name, slug: spotRes.data.slug } : null;
  const photoUrls = (photosBySession.get(session.id) ?? []).map((p) =>
    getPhotoPublicUrl(supabase, p.storage_path),
  );
  const likeCount = likeCounts.get(session.id) ?? 0;
  const liked = likedSet.has(session.id);
  const commentCount = commentCounts.get(session.id) ?? 0;

  const dateLabel = new Date(session.session_date).toLocaleDateString("en-NL", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <Link
        href={spot ? `/spots/${spot.slug}` : "/"}
        className="text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
      >
        ← {spot ? spot.name : "Home"}
      </Link>

      <article className="mt-6 overflow-hidden rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
        {/* Header */}
        <header className="px-6 pt-6">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <Link
                href={`/users/${session.user_id}`}
                className="text-2xl font-bold tracking-tight hover:underline"
              >
                {author?.display_name ?? "Someone"}
              </Link>
              {spot ? (
                <div className="mt-1 text-sm text-zinc-500">
                  at{" "}
                  <Link href={`/spots/${spot.slug}`} className="font-medium hover:underline">
                    {spot.name}
                  </Link>
                </div>
              ) : null}
            </div>
            <div className="shrink-0 text-right text-xs text-zinc-500">
              <div>{dateLabel}</div>
              <div className="mt-0.5">posted {relativeTime(session.created_at)}</div>
            </div>
          </div>
        </header>

        {/* Wind hero — bigger on detail page */}
        <SessionWindHero session={session} size="detail" />

        {/* Notes */}
        {session.notes ? (
          <p className="px-6 pb-6 text-base text-zinc-700 dark:text-zinc-300">
            {session.notes}
          </p>
        ) : null}

        {/* Photos — full grid */}
        {photoUrls.length > 0 ? (
          <div className="px-6 pb-6">
            <PhotoGrid urls={photoUrls} />
          </div>
        ) : null}

        {/* Reactions */}
        <div className="border-t border-zinc-100 px-6 py-4 dark:border-zinc-900">
          <LikeButton
            sessionId={session.id}
            initialCount={likeCount}
            initialLiked={liked}
            viewerId={viewer?.id ?? null}
          />
          <CommentSection
            sessionId={session.id}
            initialCount={commentCount}
            viewerId={viewer?.id ?? null}
            defaultOpen
          />
        </div>
      </article>
    </main>
  );
}
