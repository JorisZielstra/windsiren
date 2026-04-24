import type { RsvpRow, SessionRow, TypedSupabaseClient } from "@windsiren/supabase";
import { listFollowingIds } from "./follows";

export type SessionFeedItem = {
  type: "session";
  createdAt: string;
  userId: string;
  spotId: string;
  session: SessionRow;
};

export type RsvpFeedItem = {
  type: "rsvp";
  createdAt: string;
  userId: string;
  spotId: string;
  rsvp: RsvpRow;
};

export type FeedItem = SessionFeedItem | RsvpFeedItem;

export type FeedOptions = {
  includeSelf?: boolean;  // default true — own activity shows in feed
  limit?: number;         // per content type; final merged feed may be half
};

// Personal feed = sessions + RSVPs from users the viewer follows (and themselves).
// v0.1 implementation: two parallel queries, merge + sort client-side. Fine up
// to O(hundreds) followees; swap to an RPC function if we ever scale past that.
export async function fetchPersonalFeed(
  supabase: TypedSupabaseClient,
  viewerId: string,
  options: FeedOptions = {},
): Promise<FeedItem[]> {
  const includeSelf = options.includeSelf ?? true;
  const limit = options.limit ?? 30;

  const followingIds = await listFollowingIds(supabase, viewerId);
  const userIds = includeSelf ? [...new Set([...followingIds, viewerId])] : followingIds;
  if (userIds.length === 0) return [];

  const [sessionsRes, rsvpsRes] = await Promise.all([
    supabase
      .from("sessions")
      .select("*")
      .in("user_id", userIds)
      .order("created_at", { ascending: false })
      .limit(limit),
    supabase
      .from("rsvps")
      .select("*")
      .in("user_id", userIds)
      .order("created_at", { ascending: false })
      .limit(limit),
  ]);

  const items: FeedItem[] = [];
  for (const s of sessionsRes.data ?? []) {
    items.push({
      type: "session",
      createdAt: s.created_at,
      userId: s.user_id,
      spotId: s.spot_id,
      session: s,
    });
  }
  for (const r of rsvpsRes.data ?? []) {
    items.push({ type: "rsvp", createdAt: r.created_at, userId: r.user_id, spotId: r.spot_id, rsvp: r });
  }
  items.sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0));
  return items.slice(0, limit);
}
