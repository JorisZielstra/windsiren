import { describe, test, expect, vi } from "vitest";
import type { TypedSupabaseClient } from "@windsiren/supabase";
import { followUser, unfollowUser } from "./follows";

function clientWithInsertError(error: { code?: string; message: string } | null) {
  return {
    from: vi.fn(() => ({
      insert: vi.fn(() => Promise.resolve({ error })),
      delete: vi.fn(() => ({ eq: vi.fn(() => ({ eq: vi.fn(() => Promise.resolve({ error })) })) })),
    })),
  } as unknown as TypedSupabaseClient;
}

describe("followUser", () => {
  test("rejects self-follow before hitting the DB", async () => {
    const client = { from: vi.fn() } as unknown as TypedSupabaseClient;
    const result = await followUser(client, "u1", "u1");
    expect(result).toEqual({ ok: false, reason: "error", message: expect.stringMatching(/yourself/i) });
    expect(client.from).not.toHaveBeenCalled();
  });

  test("treats unique-violation (23505) as idempotent success", async () => {
    const client = clientWithInsertError({ code: "23505", message: "duplicate key" });
    const result = await followUser(client, "u1", "u2");
    expect(result).toEqual({ ok: true, following: true });
  });

  test("surfaces other DB errors", async () => {
    const client = clientWithInsertError({ code: "42000", message: "broken" });
    const result = await followUser(client, "u1", "u2");
    expect(result).toEqual({ ok: false, reason: "error", message: "broken" });
  });

  test("returns success when DB insert has no error", async () => {
    const client = clientWithInsertError(null);
    const result = await followUser(client, "u1", "u2");
    expect(result).toEqual({ ok: true, following: true });
  });
});

describe("unfollowUser", () => {
  test("returns success when DB delete has no error", async () => {
    const client = clientWithInsertError(null);
    const result = await unfollowUser(client, "u1", "u2");
    expect(result).toEqual({ ok: true, following: false });
  });

  test("surfaces DB errors", async () => {
    const client = clientWithInsertError({ message: "nope" });
    const result = await unfollowUser(client, "u1", "u2");
    expect(result).toEqual({ ok: false, reason: "error", message: "nope" });
  });
});
