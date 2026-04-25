import Link from "next/link";
import type { SessionRow } from "@windsiren/supabase";
import { CommentSection } from "@/components/CommentSection";
import { LikeButton } from "@/components/LikeButton";
import { PhotoGrid } from "@/components/PhotoGrid";
import { SessionWindHero } from "@/components/SessionWindHero";

type Props = {
  session: SessionRow;
  authorId: string;
  authorName: string;
  spot: { name: string; slug: string } | null;
  showAuthor?: boolean;
  showSpot?: boolean;
  createdAtRelative: string;
  photoUrls: string[];
  likeCount: number;
  liked: boolean;
  commentCount: number;
  viewerId?: string;
};

export function SessionCard({
  session,
  authorId,
  authorName,
  spot,
  showAuthor = true,
  showSpot = true,
  createdAtRelative,
  photoUrls,
  likeCount,
  liked,
  commentCount,
  viewerId,
}: Props) {
  const dateLabel = new Date(session.session_date).toLocaleDateString("en-NL", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });

  return (
    <li className="overflow-hidden rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex items-start justify-between gap-2 px-4 pt-3">
        <div className="min-w-0 text-sm">
          {showAuthor ? (
            <Link
              href={`/users/${authorId}`}
              className="font-semibold hover:underline"
            >
              {authorName}
            </Link>
          ) : null}
          {showAuthor && showSpot && spot ? (
            <span className="text-zinc-400"> · </span>
          ) : null}
          {showSpot && spot ? (
            <Link href={`/spots/${spot.slug}`} className="font-medium hover:underline">
              {spot.name}
            </Link>
          ) : null}
        </div>
        <Link
          href={`/sessions/${session.id}`}
          className="shrink-0 text-xs text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
        >
          {createdAtRelative}
        </Link>
      </div>
      <div className="px-4 pt-0.5 text-xs text-zinc-500">{dateLabel}</div>

      <SessionWindHero session={session} />

      {session.notes ? (
        <p className="px-4 pb-3 text-sm text-zinc-700 dark:text-zinc-300">
          {session.notes}
        </p>
      ) : null}

      {photoUrls.length > 0 ? (
        <div className="px-4 pb-3">
          <PhotoGrid urls={photoUrls} />
        </div>
      ) : null}

      <div className="border-t border-zinc-100 px-4 py-2 dark:border-zinc-900">
        <LikeButton
          sessionId={session.id}
          initialCount={likeCount}
          initialLiked={liked}
          viewerId={viewerId ?? null}
        />
        <CommentSection
          sessionId={session.id}
          initialCount={commentCount}
          viewerId={viewerId ?? null}
        />
      </div>
    </li>
  );
}
