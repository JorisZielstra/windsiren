import { describe, test, expect, vi } from "vitest";
import type { TypedSupabaseClient } from "@windsiren/supabase";
import { COMMENT_MAX_LENGTH, createComment, getCommentCounts } from "./comments";

function stubInsert(row: unknown, error: { message: string } | null = null) {
  const insertSpy = vi.fn(() => ({
    select: vi.fn(() => ({
      single: vi.fn(() => Promise.resolve({ data: row, error })),
    })),
  }));
  const client = {
    from: vi.fn(() => ({ insert: insertSpy })),
  } as unknown as TypedSupabaseClient;
  return { client, insertSpy };
}

describe("createComment — validation", () => {
  test("rejects empty string", async () => {
    const { client } = stubInsert(null);
    const r = await createComment(client, "u", "s", "");
    expect(r).toEqual({ ok: false, reason: "validation", message: expect.stringMatching(/empty/i) });
    expect(client.from).not.toHaveBeenCalled();
  });

  test("rejects whitespace-only", async () => {
    const { client } = stubInsert(null);
    const r = await createComment(client, "u", "s", "    \n  ");
    expect(r.ok).toBe(false);
    expect(client.from).not.toHaveBeenCalled();
  });

  test("rejects bodies over max length", async () => {
    const { client } = stubInsert(null);
    const r = await createComment(client, "u", "s", "x".repeat(COMMENT_MAX_LENGTH + 1));
    expect(r).toEqual({
      ok: false,
      reason: "validation",
      message: expect.stringMatching(/1000/),
    });
    expect(client.from).not.toHaveBeenCalled();
  });

  test("accepts at exactly max length", async () => {
    const { client } = stubInsert({ id: "c1", body: "x".repeat(COMMENT_MAX_LENGTH) });
    const r = await createComment(client, "u", "s", "x".repeat(COMMENT_MAX_LENGTH));
    expect(r.ok).toBe(true);
  });

  test("trims whitespace before insert", async () => {
    const { client, insertSpy } = stubInsert({ id: "c1", body: "hello" });
    await createComment(client, "u", "s", "   hello   ");
    const calls = insertSpy.mock.calls as unknown[][];
    expect(calls[0]?.[0]).toMatchObject({ body: "hello" });
  });

  test("surfaces DB errors", async () => {
    const { client } = stubInsert(null, { message: "RLS denied" });
    const r = await createComment(client, "u", "s", "hi");
    expect(r).toEqual({ ok: false, reason: "error", message: "RLS denied" });
  });
});

describe("getCommentCounts", () => {
  test("empty input returns empty map without DB call", async () => {
    const fakeClient = { from: vi.fn() } as unknown as TypedSupabaseClient;
    const counts = await getCommentCounts(fakeClient, []);
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
                { session_id: "s1" },
                { session_id: "s2" },
              ],
            }),
          ),
        })),
      })),
    } as unknown as TypedSupabaseClient;
    const counts = await getCommentCounts(fakeClient, ["s1", "s2"]);
    expect(counts.get("s1")).toBe(3);
    expect(counts.get("s2")).toBe(1);
  });
});
