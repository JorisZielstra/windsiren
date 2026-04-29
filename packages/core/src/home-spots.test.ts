import { describe, test, expect, vi } from "vitest";
import type { TypedSupabaseClient } from "@windsiren/supabase";
import {
  addHomeSpot,
  fetchHomeSpotIds,
  isHomeSpot,
  removeHomeSpot,
  SUGGESTED_HOME_SPOT_MAX,
} from "./home-spots";

function stubSelect(rows: unknown[] | null, error: unknown = null) {
  return {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => Promise.resolve({ data: rows, error })),
      })),
    })),
  } as unknown as TypedSupabaseClient;
}

function stubMaybeSingle(row: unknown | null) {
  return {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle: vi.fn(() => Promise.resolve({ data: row, error: null })),
          })),
        })),
      })),
    })),
  } as unknown as TypedSupabaseClient;
}

describe("fetchHomeSpotIds", () => {
  test("returns empty set when user has no home spots", async () => {
    const client = stubSelect([]);
    expect(await fetchHomeSpotIds(client, "u1")).toEqual(new Set());
  });

  test("returns set of spot ids when present", async () => {
    const client = stubSelect([{ spot_id: "s1" }, { spot_id: "s2" }]);
    expect(await fetchHomeSpotIds(client, "u1")).toEqual(new Set(["s1", "s2"]));
  });
});

describe("isHomeSpot", () => {
  test("true when row exists", async () => {
    const client = stubMaybeSingle({ spot_id: "s1" });
    expect(await isHomeSpot(client, "u1", "s1")).toBe(true);
  });

  test("false when row missing", async () => {
    const client = stubMaybeSingle(null);
    expect(await isHomeSpot(client, "u1", "s1")).toBe(false);
  });
});

describe("addHomeSpot", () => {
  test("inserts at position 0 when user has no existing entries", async () => {
    const insertSpy = vi.fn(() => Promise.resolve({ error: null }));
    const client = {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            order: vi.fn(() => ({
              limit: vi.fn(() => Promise.resolve({ data: [], error: null })),
            })),
          })),
        })),
        insert: insertSpy,
      })),
    } as unknown as TypedSupabaseClient;

    const result = await addHomeSpot(client, "u1", "s1");
    expect(result).toEqual({ ok: true, isHome: true });
    const calls = insertSpy.mock.calls as unknown[][];
    const firstCall = calls[0];
    expect(firstCall?.[0]).toMatchObject({
      user_id: "u1",
      spot_id: "s1",
      position: 0,
    });
  });

  test("appends after the highest existing position", async () => {
    const insertSpy = vi.fn(() => Promise.resolve({ error: null }));
    const client = {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            order: vi.fn(() => ({
              limit: vi.fn(() =>
                Promise.resolve({ data: [{ position: 4 }], error: null }),
              ),
            })),
          })),
        })),
        insert: insertSpy,
      })),
    } as unknown as TypedSupabaseClient;

    await addHomeSpot(client, "u1", "s2");
    const calls = insertSpy.mock.calls as unknown[][];
    const firstCall = calls[0];
    expect(firstCall?.[0]).toMatchObject({ position: 5 });
  });

  test("treats PK violation (23505) as idempotent success", async () => {
    const client = {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            order: vi.fn(() => ({
              limit: vi.fn(() => Promise.resolve({ data: [], error: null })),
            })),
          })),
        })),
        insert: vi.fn(() =>
          Promise.resolve({
            error: { code: "23505", message: "duplicate key value" },
          }),
        ),
      })),
    } as unknown as TypedSupabaseClient;

    const result = await addHomeSpot(client, "u1", "s1");
    expect(result).toEqual({ ok: true, isHome: true });
  });

  test("returns error when the insert fails", async () => {
    const client = {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            order: vi.fn(() => ({
              limit: vi.fn(() => Promise.resolve({ data: [], error: null })),
            })),
          })),
        })),
        insert: vi.fn(() =>
          Promise.resolve({ error: { message: "duplicate" } }),
        ),
      })),
    } as unknown as TypedSupabaseClient;

    const result = await addHomeSpot(client, "u1", "s1");
    expect(result).toEqual({
      ok: false,
      reason: "error",
      message: "duplicate",
    });
  });
});

describe("removeHomeSpot", () => {
  test("succeeds when delete returns no error", async () => {
    const client = {
      from: vi.fn(() => ({
        delete: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => Promise.resolve({ error: null })),
          })),
        })),
      })),
    } as unknown as TypedSupabaseClient;
    expect(await removeHomeSpot(client, "u1", "s1")).toEqual({
      ok: true,
      isHome: false,
    });
  });
});

describe("SUGGESTED_HOME_SPOT_MAX", () => {
  test("is exported as a small soft cap", () => {
    expect(SUGGESTED_HOME_SPOT_MAX).toBeGreaterThanOrEqual(1);
    expect(SUGGESTED_HOME_SPOT_MAX).toBeLessThanOrEqual(10);
  });
});
