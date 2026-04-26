import type { TypedSupabaseClient } from "@windsiren/supabase";
import type { PublicProfile } from "./follows";

export type UpdateProfileInput = {
  displayName?: string | null;
  bio?: string | null;
  avatarUrl?: string | null;
};

export type UpdateProfileResult =
  | { ok: true }
  | { ok: false; reason: "error"; message: string };

export async function getPublicProfile(
  supabase: TypedSupabaseClient,
  userId: string,
): Promise<PublicProfile | null> {
  const { data } = await supabase
    .from("users")
    .select("id, display_name, avatar_url, bio, created_at")
    .eq("id", userId)
    .maybeSingle();
  return data;
}

export async function getPublicProfiles(
  supabase: TypedSupabaseClient,
  userIds: string[],
): Promise<Map<string, PublicProfile>> {
  if (userIds.length === 0) return new Map();
  const { data } = await supabase
    .from("users")
    .select("id, display_name, avatar_url, bio, created_at")
    .in("id", userIds);
  const map = new Map<string, PublicProfile>();
  for (const row of data ?? []) {
    map.set(row.id, row);
  }
  return map;
}

export async function updateOwnProfile(
  supabase: TypedSupabaseClient,
  userId: string,
  input: UpdateProfileInput,
): Promise<UpdateProfileResult> {
  const update: {
    display_name?: string | null;
    bio?: string | null;
    avatar_url?: string | null;
  } = {};
  if (input.displayName !== undefined) update.display_name = normalizeText(input.displayName);
  if (input.bio !== undefined) update.bio = normalizeText(input.bio);
  if (input.avatarUrl !== undefined) update.avatar_url = normalizeText(input.avatarUrl);
  if (Object.keys(update).length === 0) return { ok: true };

  const { error } = await supabase.from("users").update(update).eq("id", userId);
  if (error) return { ok: false, reason: "error", message: error.message };
  return { ok: true };
}

function normalizeText(v: string | null | undefined): string | null {
  if (v === null || v === undefined) return null;
  const trimmed = v.trim();
  return trimmed.length === 0 ? null : trimmed;
}

// Stamps the user as having completed (or skipped) the welcome flow.
// Idempotent — once set, the column stays set; re-calling is a no-op
// for routing purposes since both branches read "non-null = onboarded".
export async function markOnboarded(
  supabase: TypedSupabaseClient,
  userId: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const { error } = await supabase
    .from("users")
    .update({ onboarded_at: new Date().toISOString() })
    .eq("id", userId);
  if (error) return { ok: false, message: error.message };
  return { ok: true };
}

// Reads only the onboarding flag — used by the routing guard so we don't
// overfetch the full profile row on every request.
export async function isOnboarded(
  supabase: TypedSupabaseClient,
  userId: string,
): Promise<boolean> {
  const { data } = await supabase
    .from("users")
    .select("onboarded_at")
    .eq("id", userId)
    .maybeSingle();
  return data?.onboarded_at != null;
}
