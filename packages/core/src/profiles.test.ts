import { describe, test, expect, vi } from "vitest";
import type { TypedSupabaseClient } from "@windsiren/supabase";
import { updateOwnProfile } from "./profiles";

function stubUpdate(error: { message: string } | null = null) {
  const updateCalls: Array<Record<string, unknown>> = [];
  const client = {
    from: vi.fn(() => ({
      update: vi.fn((payload: Record<string, unknown>) => {
        updateCalls.push(payload);
        return { eq: vi.fn(() => Promise.resolve({ error })) };
      }),
    })),
  } as unknown as TypedSupabaseClient;
  return { client, updateCalls };
}

describe("updateOwnProfile — text normalization", () => {
  test("trims whitespace", async () => {
    const { client, updateCalls } = stubUpdate();
    await updateOwnProfile(client, "u1", { displayName: "  Joris  " });
    expect(updateCalls[0]).toEqual({ display_name: "Joris" });
  });

  test("converts empty-after-trim to null (clears the field)", async () => {
    const { client, updateCalls } = stubUpdate();
    await updateOwnProfile(client, "u1", { bio: "   " });
    expect(updateCalls[0]).toEqual({ bio: null });
  });

  test("passes explicit null through to clear the field", async () => {
    const { client, updateCalls } = stubUpdate();
    await updateOwnProfile(client, "u1", { bio: null });
    expect(updateCalls[0]).toEqual({ bio: null });
  });

  test("omits undefined fields from the update payload", async () => {
    const { client, updateCalls } = stubUpdate();
    await updateOwnProfile(client, "u1", { displayName: "Joris" });
    expect(updateCalls[0]).toEqual({ display_name: "Joris" });
    expect(updateCalls[0]).not.toHaveProperty("bio");
    expect(updateCalls[0]).not.toHaveProperty("avatar_url");
  });

  test("short-circuits (no DB call) when input has no fields", async () => {
    const { client } = stubUpdate();
    const r = await updateOwnProfile(client, "u1", {});
    expect(r).toEqual({ ok: true });
    expect(client.from).not.toHaveBeenCalled();
  });

  test("surfaces DB errors", async () => {
    const { client } = stubUpdate({ message: "bad" });
    const r = await updateOwnProfile(client, "u1", { displayName: "x" });
    expect(r).toEqual({ ok: false, reason: "error", message: "bad" });
  });
});
