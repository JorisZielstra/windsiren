import { describe, test, expect, vi } from "vitest";
import type { TypedSupabaseClient } from "@windsiren/supabase";
import { getFriendsOnWaterToday } from "./friends-today";

// Builds a stub supabase client whose `from(table)` is dispatched to a per-
// table builder. Each builder ends in a thenable that resolves with rows.
function buildClient(handlers: {
  follows?: { data: { followee_id: string }[] };
  sessions?: { data: { user_id: string }[] };
  rsvps?: { data: { user_id: string }[] };
  users?: { data: { id: string; display_name: string | null; avatar_url: string | null; bio: string | null; created_at: string }[] };
}): TypedSupabaseClient {
  return {
    from: vi.fn((table: string) => {
      if (table === "follows") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => Promise.resolve(handlers.follows ?? { data: [] })),
          })),
        };
      }
      if (table === "sessions") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              in: vi.fn(() => Promise.resolve(handlers.sessions ?? { data: [] })),
            })),
          })),
        };
      }
      if (table === "rsvps") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              in: vi.fn(() => Promise.resolve(handlers.rsvps ?? { data: [] })),
            })),
          })),
        };
      }
      if (table === "users") {
        return {
          select: vi.fn(() => ({
            in: vi.fn(() => Promise.resolve(handlers.users ?? { data: [] })),
          })),
        };
      }
      throw new Error(`Unexpected table: ${table}`);
    }),
  } as unknown as TypedSupabaseClient;
}

const baseProfile = (id: string, name: string) => ({
  id,
  display_name: name,
  avatar_url: null,
  bio: null,
  created_at: "2026-01-01T00:00:00Z",
});

describe("getFriendsOnWaterToday", () => {
  test("returns empty when the viewer follows no one", async () => {
    const client = buildClient({ follows: { data: [] } });
    const result = await getFriendsOnWaterToday(client, "u1", "2026-04-26");
    expect(result).toEqual({ count: 0, profiles: [] });
  });

  test("returns empty when no followed users have activity today", async () => {
    const client = buildClient({
      follows: { data: [{ followee_id: "u2" }, { followee_id: "u3" }] },
      sessions: { data: [] },
      rsvps: { data: [] },
    });
    const result = await getFriendsOnWaterToday(client, "u1", "2026-04-26");
    expect(result).toEqual({ count: 0, profiles: [] });
  });

  test("counts a follower with a session today", async () => {
    const client = buildClient({
      follows: { data: [{ followee_id: "u2" }] },
      sessions: { data: [{ user_id: "u2" }] },
      rsvps: { data: [] },
      users: { data: [baseProfile("u2", "Anna")] },
    });
    const result = await getFriendsOnWaterToday(client, "u1", "2026-04-26");
    expect(result.count).toBe(1);
    expect(result.profiles.map((p) => p.display_name)).toEqual(["Anna"]);
  });

  test("dedupes a follower with both a session and an RSVP for today", async () => {
    const client = buildClient({
      follows: { data: [{ followee_id: "u2" }] },
      sessions: { data: [{ user_id: "u2" }] },
      rsvps: { data: [{ user_id: "u2" }] },
      users: { data: [baseProfile("u2", "Anna")] },
    });
    const result = await getFriendsOnWaterToday(client, "u1", "2026-04-26");
    expect(result.count).toBe(1);
  });

  test("merges sessions + rsvps and sorts by display_name", async () => {
    const client = buildClient({
      follows: {
        data: [{ followee_id: "u2" }, { followee_id: "u3" }, { followee_id: "u4" }],
      },
      sessions: { data: [{ user_id: "u2" }] },
      rsvps: { data: [{ user_id: "u3" }, { user_id: "u4" }] },
      users: {
        data: [
          baseProfile("u2", "Tom"),
          baseProfile("u3", "Anna"),
          baseProfile("u4", "Maartje"),
        ],
      },
    });
    const result = await getFriendsOnWaterToday(client, "u1", "2026-04-26");
    expect(result.count).toBe(3);
    expect(result.profiles.map((p) => p.display_name)).toEqual([
      "Anna",
      "Maartje",
      "Tom",
    ]);
  });
});
