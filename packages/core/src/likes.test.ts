import { describe, test, expect, vi } from "vitest";
import type { TypedSupabaseClient } from "@windsiren/supabase";
import { getLikeCounts, getLikedSessionIds, likeSession, unlikeSession } from "./likes";

function client(error: { code?: string; message: string } | null = null) {
  return {
    from: vi.fn(() => ({
      insert: vi.fn(() => Promise.resolve({ error })),
      delete: vi.fn(() => ({ eq: vi.fn(() => ({ eq: vi.fn(() => Promise.resolve({ error })) })) })),
    })),
  } as unknown as TypedSupabaseClient;
}

describe("likeSession", () => {
  test("succeeds on clean insert", async () => {
    const r = await likeSession(client(null), "u", "s");
    expect(r).toEqual({ ok: true, liked: true });
  });

  test("treats unique violation 23505 as idempotent success", async () => {
    const r = await likeSession(client({ code: "23505", message: "duplicate" }), "u", "s");
    expect(r).toEqual({ ok: true, liked: true });
  });

  test("surfaces other errors", async () => {
    const r = await likeSession(client({ code: "42000", message: "bad" }), "u", "s");
    expect(r).toEqual({ ok: false, reason: "error", message: "bad" });
  });
});

describe("unlikeSession", () => {
  test("succeeds on clean delete", async () => {
    const r = await unlikeSession(client(null), "u", "s");
    expect(r).toEqual({ ok: true, liked: false });
  });

  test("surfaces errors", async () => {
    const r = await unlikeSession(client({ message: "no" }), "u", "s");
    expect(r).toEqual({ ok: false, reason: "error", message: "no" });
  });
});

describe("getLikeCounts", () => {
  test("returns empty map for no input", async () => {
    const fakeClient = { from: vi.fn() } as unknown as TypedSupabaseClient;
    const counts = await getLikeCounts(fakeClient, []);
    expect(counts.size).toBe(0);
    expect(fakeClient.from).not.toHaveBeenCalled();
  });

  test("aggregates rows by session_id", async () => {
    const fakeClient = {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          in: vi.fn(() =>
            Promise.resolve({
              data: [
                { session_id: "s1" },
                { session_id: "s1" },
                { session_id: "s2" },
              ],
            }),
          ),
        })),
      })),
    } as unknown as TypedSupabaseClient;
    const counts = await getLikeCounts(fakeClient, ["s1", "s2", "s3"]);
    expect(counts.get("s1")).toBe(2);
    expect(counts.get("s2")).toBe(1);
    expect(counts.has("s3")).toBe(false);
  });
});

describe("getLikedSessionIds", () => {
  test("returns set of liked session ids", async () => {
    const fakeClient = {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            in: vi.fn(() =>
              Promise.resolve({ data: [{ session_id: "s1" }, { session_id: "s3" }] }),
            ),
          })),
        })),
      })),
    } as unknown as TypedSupabaseClient;
    const liked = await getLikedSessionIds(fakeClient, "u", ["s1", "s2", "s3"]);
    expect(liked.has("s1")).toBe(true);
    expect(liked.has("s2")).toBe(false);
    expect(liked.has("s3")).toBe(true);
  });
});
