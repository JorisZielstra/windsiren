import { describe, test, expect, vi } from "vitest";
import type { TypedSupabaseClient } from "@windsiren/supabase";
import { getMonthlySessions } from "./monthly-sessions";

function stubSelect(rows: unknown[] | null) {
  return {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          gte: vi.fn(() => Promise.resolve({ data: rows, error: null })),
        })),
      })),
    })),
  } as unknown as TypedSupabaseClient;
}

// Reference "now" pinned for deterministic bucket math. Picked late in the
// month so the daylight-saving spread doesn't shift the bucket boundary.
const NOW = new Date(Date.UTC(2026, 3, 26, 12, 0, 0)); // 2026-04-26

describe("getMonthlySessions", () => {
  test("returns the requested number of buckets, all empty when no sessions", async () => {
    const client = stubSelect([]);
    const result = await getMonthlySessions(client, "u1", 6, NOW);
    expect(result).toHaveLength(6);
    expect(result[result.length - 1]!.monthKey).toBe("2026-04");
    expect(result[0]!.monthKey).toBe("2025-11");
    expect(result.every((b) => b.sessionCount === 0)).toBe(true);
    expect(result.every((b) => b.totalMinutes === 0)).toBe(true);
  });

  test("buckets are returned in ascending chronological order", async () => {
    const client = stubSelect([]);
    const result = await getMonthlySessions(client, "u1", 12, NOW);
    expect(result).toHaveLength(12);
    expect(result[0]!.monthKey).toBe("2025-05");
    expect(result[11]!.monthKey).toBe("2026-04");
    // Strictly ascending
    for (let i = 1; i < result.length; i++) {
      expect(result[i]!.monthKey > result[i - 1]!.monthKey).toBe(true);
    }
  });

  test("aggregates session_count + total_minutes per month", async () => {
    const client = stubSelect([
      { session_date: "2026-04-12", duration_minutes: 60 },
      { session_date: "2026-04-20", duration_minutes: 90 },
      { session_date: "2026-03-30", duration_minutes: 45 },
      { session_date: "2026-02-01", duration_minutes: 30 },
    ]);
    const result = await getMonthlySessions(client, "u1", 6, NOW);
    const byKey = Object.fromEntries(result.map((b) => [b.monthKey, b]));
    expect(byKey["2026-04"]).toEqual({
      monthKey: "2026-04",
      sessionCount: 2,
      totalMinutes: 150,
    });
    expect(byKey["2026-03"]).toEqual({
      monthKey: "2026-03",
      sessionCount: 1,
      totalMinutes: 45,
    });
    expect(byKey["2026-02"]).toEqual({
      monthKey: "2026-02",
      sessionCount: 1,
      totalMinutes: 30,
    });
  });

  test("ignores sessions older than the rolling window", async () => {
    const client = stubSelect([
      { session_date: "2024-01-15", duration_minutes: 60 }, // outside window
      { session_date: "2026-04-01", duration_minutes: 75 },
    ]);
    const result = await getMonthlySessions(client, "u1", 6, NOW);
    const total = result.reduce((s, b) => s + b.sessionCount, 0);
    expect(total).toBe(1);
  });
});
