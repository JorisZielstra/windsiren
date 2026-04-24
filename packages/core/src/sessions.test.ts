import { describe, test, expect, vi } from "vitest";
import type { TypedSupabaseClient } from "@windsiren/supabase";
import { createSession } from "./sessions";

function stubInsertReturning(row: unknown, error: { message: string } | null = null) {
  return {
    from: vi.fn(() => ({
      insert: vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn(() => Promise.resolve({ data: row, error })),
        })),
      })),
    })),
  } as unknown as TypedSupabaseClient;
}

const BASE_INPUT = {
  userId: "u1",
  spotId: "s1",
  sessionDate: "2026-04-24",
  durationMinutes: 60,
};

describe("createSession — duration validation", () => {
  test("rejects 0 minutes", async () => {
    const client = stubInsertReturning(null);
    const r = await createSession(client, { ...BASE_INPUT, durationMinutes: 0 });
    expect(r).toEqual({ ok: false, reason: "validation", message: expect.stringMatching(/1 and 1439/) });
    expect(client.from).not.toHaveBeenCalled();
  });

  test("rejects negative minutes", async () => {
    const client = stubInsertReturning(null);
    const r = await createSession(client, { ...BASE_INPUT, durationMinutes: -5 });
    expect(r.ok).toBe(false);
    expect(client.from).not.toHaveBeenCalled();
  });

  test("rejects >= 1440 (24h)", async () => {
    const client = stubInsertReturning(null);
    const r = await createSession(client, { ...BASE_INPUT, durationMinutes: 1440 });
    expect(r.ok).toBe(false);
    expect(client.from).not.toHaveBeenCalled();
  });

  test("rejects NaN", async () => {
    const client = stubInsertReturning(null);
    const r = await createSession(client, { ...BASE_INPUT, durationMinutes: NaN });
    expect(r.ok).toBe(false);
  });

  test("accepts 1 (boundary)", async () => {
    const client = stubInsertReturning({ id: "sess1" });
    const r = await createSession(client, { ...BASE_INPUT, durationMinutes: 1 });
    expect(r.ok).toBe(true);
  });

  test("accepts 1439 (just under 24h)", async () => {
    const client = stubInsertReturning({ id: "sess1" });
    const r = await createSession(client, { ...BASE_INPUT, durationMinutes: 1439 });
    expect(r.ok).toBe(true);
  });

  test("returns the created row on success", async () => {
    const row = { id: "sess1", user_id: "u1", spot_id: "s1", duration_minutes: 60 };
    const client = stubInsertReturning(row);
    const r = await createSession(client, BASE_INPUT);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.session).toEqual(row);
  });

  test("surfaces DB errors", async () => {
    const client = stubInsertReturning(null, { message: "RLS denied" });
    const r = await createSession(client, BASE_INPUT);
    expect(r).toEqual({ ok: false, reason: "error", message: "RLS denied" });
  });
});
