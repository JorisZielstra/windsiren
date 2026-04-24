import { describe, test, expect, vi } from "vitest";
import type { TypedSupabaseClient } from "@windsiren/supabase";
import { fetchPersonalFeed } from "./feed";

// Builds a fake client where `.from('follows')` returns follower-list data,
// `.from('sessions')` returns sessions data, and `.from('rsvps')` returns rsvps.
function makeClient(opts: {
  followingIds: string[];
  sessions: Array<{
    id: string;
    user_id: string;
    spot_id: string;
    created_at: string;
    session_date?: string;
    duration_minutes?: number;
    notes?: string | null;
    updated_at?: string;
  }>;
  rsvps: Array<{
    id: string;
    user_id: string;
    spot_id: string;
    created_at: string;
    planned_date?: string;
  }>;
}): TypedSupabaseClient {
  const followingChain = {
    select: vi.fn(() => followingChain),
    eq: vi.fn(() =>
      Promise.resolve({ data: opts.followingIds.map((id) => ({ followee_id: id })) }),
    ),
  };
  const sessionsChain = {
    select: vi.fn(() => sessionsChain),
    in: vi.fn(() => sessionsChain),
    order: vi.fn(() => sessionsChain),
    limit: vi.fn(() => Promise.resolve({ data: opts.sessions })),
  };
  const rsvpsChain = {
    select: vi.fn(() => rsvpsChain),
    in: vi.fn(() => rsvpsChain),
    order: vi.fn(() => rsvpsChain),
    limit: vi.fn(() => Promise.resolve({ data: opts.rsvps })),
  };
  return {
    from: vi.fn((table: string) => {
      if (table === "follows") return followingChain;
      if (table === "sessions") return sessionsChain;
      if (table === "rsvps") return rsvpsChain;
      throw new Error(`unexpected table: ${table}`);
    }),
  } as unknown as TypedSupabaseClient;
}

describe("fetchPersonalFeed", () => {
  test("returns [] when user follows nobody and includeSelf is false", async () => {
    const client = makeClient({ followingIds: [], sessions: [], rsvps: [] });
    const result = await fetchPersonalFeed(client, "me", { includeSelf: false });
    expect(result).toEqual([]);
  });

  test("includes self by default", async () => {
    const client = makeClient({
      followingIds: [],
      sessions: [
        {
          id: "s1",
          user_id: "me",
          spot_id: "spot1",
          created_at: "2026-04-24T12:00:00Z",
        },
      ],
      rsvps: [],
    });
    const result = await fetchPersonalFeed(client, "me");
    expect(result).toHaveLength(1);
    expect(result[0]?.type).toBe("session");
  });

  test("merges sessions + rsvps newest-first", async () => {
    const client = makeClient({
      followingIds: ["friend"],
      sessions: [
        { id: "s1", user_id: "me", spot_id: "spot1", created_at: "2026-04-24T09:00:00Z" },
        { id: "s2", user_id: "friend", spot_id: "spot2", created_at: "2026-04-24T11:00:00Z" },
      ],
      rsvps: [
        {
          id: "r1",
          user_id: "friend",
          spot_id: "spot1",
          created_at: "2026-04-24T10:00:00Z",
        },
      ],
    });
    const result = await fetchPersonalFeed(client, "me");
    expect(result.map((i) => i.createdAt)).toEqual([
      "2026-04-24T11:00:00Z",
      "2026-04-24T10:00:00Z",
      "2026-04-24T09:00:00Z",
    ]);
    expect(result.map((i) => i.type)).toEqual(["session", "rsvp", "session"]);
  });

  test("respects the limit after merging", async () => {
    const sessions = Array.from({ length: 10 }, (_, i) => ({
      id: `s${i}`,
      user_id: "me",
      spot_id: "spot",
      created_at: `2026-04-24T${String(10 + i).padStart(2, "0")}:00:00Z`,
    }));
    const client = makeClient({ followingIds: [], sessions, rsvps: [] });
    const result = await fetchPersonalFeed(client, "me", { limit: 3 });
    expect(result).toHaveLength(3);
    // Newest first after merge + slice
    expect(result[0]?.createdAt).toBe("2026-04-24T19:00:00Z");
  });
});
