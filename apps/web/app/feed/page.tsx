import Link from "next/link";
import { redirect } from "next/navigation";
import {
  fetchPersonalFeed,
  getCommentCounts,
  getLikeCounts,
  getLikedSessionIds,
  getPhotosForSessions,
  getPhotoPublicUrl,
  getPublicProfiles,
  type FeedItem,
} from "@windsiren/core";
import { SessionCard } from "@/components/SessionCard";
import { relativeTime } from "@/lib/relative-time";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

export default async function FeedPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/sign-in");

  const items = await fetchPersonalFeed(supabase, user.id, { limit: 50, includeSelf: true });

  const authorIds = Array.from(new Set(items.map((i) => i.userId)));
  const spotIds = Array.from(new Set(items.map((i) => i.spotId)));
  const sessionIds = items.filter((i) => i.type === "session").map((i) => i.session.id);

  const [profiles, spotRes, likeCounts, likedSet, photosBySession, commentCounts] =
    await Promise.all([
      getPublicProfiles(supabase, authorIds),
      spotIds.length > 0
        ? supabase.from("spots").select("id, name, slug").in("id", spotIds)
        : Promise.resolve({ data: [] }),
      getLikeCounts(supabase, sessionIds),
      getLikedSessionIds(supabase, user.id, sessionIds),
      getPhotosForSessions(supabase, sessionIds),
      getCommentCounts(supabase, sessionIds),
    ]);
  const spotMap = new Map<string, { name: string; slug: string }>();
  for (const s of spotRes.data ?? []) spotMap.set(s.id, { name: s.name, slug: s.slug });

  const photoUrlsBySession = new Map<string, string[]>();
  for (const [sid, photos] of photosBySession) {
    photoUrlsBySession.set(
      sid,
      photos.map((p) => getPhotoPublicUrl(supabase, p.storage_path)),
    );
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <Link href="/" className="text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100">
        ← Home
      </Link>
      <h1 className="mt-4 text-4xl font-bold tracking-tight">Feed</h1>
      <p className="mt-2 text-zinc-600 dark:text-zinc-400">
        Sessions and RSVPs from people you follow, plus your own.
      </p>

      {items.length === 0 ? (
        <div className="mt-10 rounded-md border border-zinc-200 p-8 text-center dark:border-zinc-800">
          <p className="font-medium">Your feed is empty.</p>
          <p className="mt-1 text-sm text-zinc-500">
            Follow other kiters on a spot page to see their activity here.
          </p>
        </div>
      ) : (
        <ul className="mt-8 space-y-3">
          {items.map((item) => (
            <FeedRow
              key={feedItemKey(item)}
              item={item}
              authorName={profiles.get(item.userId)?.display_name ?? "Someone"}
              spot={spotMap.get(item.spotId) ?? null}
              viewerId={user.id}
              likeCount={
                item.type === "session" ? likeCounts.get(item.session.id) ?? 0 : 0
              }
              liked={item.type === "session" && likedSet.has(item.session.id)}
              photoUrls={
                item.type === "session" ? photoUrlsBySession.get(item.session.id) ?? [] : []
              }
              commentCount={
                item.type === "session" ? commentCounts.get(item.session.id) ?? 0 : 0
              }
            />
          ))}
        </ul>
      )}
    </main>
  );
}

function feedItemKey(item: FeedItem): string {
  return item.type === "session" ? `s:${item.session.id}` : `r:${item.rsvp.id}`;
}

function FeedRow({
  item,
  authorName,
  spot,
  viewerId,
  likeCount,
  liked,
  photoUrls,
  commentCount,
}: {
  item: FeedItem;
  authorName: string;
  spot: { name: string; slug: string } | null;
  viewerId: string;
  likeCount: number;
  liked: boolean;
  photoUrls: string[];
  commentCount: number;
}) {
  if (item.type === "session") {
    return (
      <SessionCard
        session={item.session}
        authorId={item.userId}
        authorName={authorName}
        spot={spot}
        createdAtRelative={relativeTime(item.createdAt)}
        photoUrls={photoUrls}
        likeCount={likeCount}
        liked={liked}
        commentCount={commentCount}
        viewerId={viewerId}
      />
    );
  }

  // RSVP — kept intentionally compact: it's an intent, not an event.
  const r = item.rsvp;
  const spotLabel = spot ? (
    <Link href={`/spots/${spot.slug}`} className="font-medium hover:underline">
      {spot.name}
    </Link>
  ) : (
    <span className="font-medium">Unknown spot</span>
  );
  return (
    <li className="rounded-md border border-zinc-200 px-4 py-3 dark:border-zinc-800">
      <div className="flex items-center justify-between gap-2">
        <div className="text-sm">
          <Link href={`/users/${item.userId}`} className="font-medium hover:underline">
            {authorName}
          </Link>{" "}
          is going to {spotLabel} on{" "}
          <span className="font-medium">
            {new Date(r.planned_date).toLocaleDateString("en-NL", {
              weekday: "long",
              month: "short",
              day: "numeric",
            })}
          </span>
        </div>
        <div className="text-xs text-zinc-500">{relativeTime(item.createdAt)}</div>
      </div>
    </li>
  );
}

