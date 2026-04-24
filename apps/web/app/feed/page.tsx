import Link from "next/link";
import { redirect } from "next/navigation";
import {
  fetchPersonalFeed,
  getPublicProfiles,
  type FeedItem,
} from "@windsiren/core";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

export default async function FeedPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/sign-in");

  const items = await fetchPersonalFeed(supabase, user.id, { limit: 50, includeSelf: true });

  // Resolve author profiles + spot names in one round-trip each.
  const authorIds = Array.from(new Set(items.map((i) => i.userId)));
  const spotIds = Array.from(new Set(items.map((i) => i.spotId)));
  const [profiles, spotRes] = await Promise.all([
    getPublicProfiles(supabase, authorIds),
    spotIds.length > 0
      ? supabase.from("spots").select("id, name, slug").in("id", spotIds)
      : Promise.resolve({ data: [] }),
  ]);
  const spotMap = new Map<string, { name: string; slug: string }>();
  for (const s of spotRes.data ?? []) spotMap.set(s.id, { name: s.name, slug: s.slug });

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
              spot={spotMap.get(item.spotId)}
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
}: {
  item: FeedItem;
  authorName: string;
  spot: { name: string; slug: string } | undefined;
}) {
  const spotLabel = spot ? (
    <Link href={`/spots/${spot.slug}`} className="font-medium hover:underline">
      {spot.name}
    </Link>
  ) : (
    <span className="font-medium">Unknown spot</span>
  );
  const author = (
    <Link href={`/users/${item.userId}`} className="font-medium hover:underline">
      {authorName}
    </Link>
  );

  if (item.type === "session") {
    const s = item.session;
    return (
      <li className="rounded-md border border-zinc-200 px-4 py-3 dark:border-zinc-800">
        <div className="flex items-center justify-between gap-2">
          <div className="text-sm">
            {author} kited at {spotLabel} for{" "}
            <span className="font-mono">{s.duration_minutes} min</span>
          </div>
          <div className="text-xs text-zinc-500">{relativeTime(item.createdAt)}</div>
        </div>
        <div className="mt-0.5 text-xs text-zinc-500">
          {new Date(s.session_date).toLocaleDateString("en-NL", {
            weekday: "short",
            month: "short",
            day: "numeric",
          })}
        </div>
        {s.notes ? (
          <p className="mt-2 text-sm text-zinc-700 dark:text-zinc-300">{s.notes}</p>
        ) : null}
      </li>
    );
  }

  // RSVP
  const r = item.rsvp;
  return (
    <li className="rounded-md border border-zinc-200 px-4 py-3 dark:border-zinc-800">
      <div className="flex items-center justify-between gap-2">
        <div className="text-sm">
          {author} is going to {spotLabel} on{" "}
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

function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const diffMin = Math.max(0, Math.round((now - then) / 60000));
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin} min ago`;
  const h = Math.round(diffMin / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString("en-NL", { month: "short", day: "numeric" });
}
