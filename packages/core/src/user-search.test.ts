import { describe, test, expect, vi } from "vitest";
import type { TypedSupabaseClient } from "@windsiren/supabase";
import { searchUsers } from "./user-search";

function stubSearch(rows: unknown[] | null) {
  const limit = vi.fn(() => Promise.resolve({ data: rows, error: null }));
  const order = vi.fn(() => ({ limit }));
  const ilike = vi.fn(() => ({ order }));
  const select = vi.fn(() => ({ ilike }));
  const from = vi.fn(() => ({ select }));
  return {
    client: { from } as unknown as TypedSupabaseClient,
    spies: { from, select, ilike, order, limit },
  };
}

describe("searchUsers", () => {
  test("returns empty list for short queries", async () => {
    const { client, spies } = stubSearch([]);
    expect(await searchUsers(client, "a")).toEqual([]);
    expect(spies.from).not.toHaveBeenCalled();
  });

  test("queries users with ilike and returns matches", async () => {
    const { client, spies } = stubSearch([
      { id: "u1", display_name: "Alice", avatar_url: null },
      { id: "u2", display_name: "Albert", avatar_url: "https://x" },
    ]);
    const results = await searchUsers(client, "Al");
    expect(results).toHaveLength(2);
    expect(spies.ilike).toHaveBeenCalledWith("display_name", "%Al%");
  });

  test("strips wildcard and PostgREST chars from the query", async () => {
    const { client, spies } = stubSearch([]);
    await searchUsers(client, "Al%i_ce,*");
    expect(spies.ilike).toHaveBeenCalledWith("display_name", "%Alice%");
  });

  test("filters out rows with null display_name", async () => {
    const { client } = stubSearch([
      { id: "u1", display_name: "Alice", avatar_url: null },
      { id: "u2", display_name: null, avatar_url: null },
    ]);
    const results = await searchUsers(client, "Al");
    expect(results.map((r) => r.id)).toEqual(["u1"]);
  });
});
