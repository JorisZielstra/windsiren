import { describe, test, expect, vi } from "vitest";
import type { TypedSupabaseClient } from "@windsiren/supabase";
import { EMPTY_USER_STATS, getUserStats } from "./user-stats";

function stubSelect(rows: unknown[] | null, error: { message: string } | null = null) {
  return {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => Promise.resolve({ data: rows, error })),
      })),
    })),
  } as unknown as TypedSupabaseClient;
}

describe("getUserStats", () => {
  test("returns empty stats when the user has no sessions", async () => {
    const client = stubSelect([]);
    expect(await getUserStats(client, "u1")).toEqual(EMPTY_USER_STATS);
  });

  test("returns empty stats when the query yields null data", async () => {
    const client = stubSelect(null);
    expect(await getUserStats(client, "u1")).toEqual(EMPTY_USER_STATS);
  });

  test("aggregates totals, longest session, and last date across rows", async () => {
    const client = stubSelect([
      {
        spot_id: "s1",
        session_date: "2026-04-20",
        duration_minutes: 60,
        wind_avg_ms: 8,
        gust_max_ms: 12,
        max_jump_m: 4,
      },
      {
        spot_id: "s1",
        session_date: "2026-04-22",
        duration_minutes: 90,
        wind_avg_ms: 10,
        gust_max_ms: 15,
        max_jump_m: 6,
      },
      {
        spot_id: "s2",
        session_date: "2026-04-21",
        duration_minutes: 30,
        wind_avg_ms: null,
        gust_max_ms: null,
        max_jump_m: null,
      },
    ]);

    const stats = await getUserStats(client, "u1");
    expect(stats.sessionCount).toBe(3);
    expect(stats.totalMinutes).toBe(180);
    expect(stats.longestSessionMinutes).toBe(90);
    expect(stats.biggestGustMs).toBe(15);
    expect(stats.biggestAvgWindMs).toBe(10);
    expect(stats.biggestJumpM).toBe(6);
    // s1 wins with 2 sessions vs s2's 1.
    expect(stats.topSpot).toEqual({ spotId: "s1", sessionCount: 2 });
    expect(stats.lastSessionDate).toBe("2026-04-22");
  });

  test("treats null wind / jump values as missing rather than zero", async () => {
    const client = stubSelect([
      {
        spot_id: "s1",
        session_date: "2026-04-20",
        duration_minutes: 60,
        wind_avg_ms: null,
        gust_max_ms: null,
        max_jump_m: null,
      },
    ]);
    const stats = await getUserStats(client, "u1");
    expect(stats.biggestGustMs).toBeNull();
    expect(stats.biggestAvgWindMs).toBeNull();
    expect(stats.biggestJumpM).toBeNull();
    expect(stats.totalMinutes).toBe(60);
  });
});
