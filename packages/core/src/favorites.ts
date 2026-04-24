import type { Spot } from "@windsiren/shared";
import type { TypedSupabaseClient } from "@windsiren/supabase";
import { dbRowToSpot } from "./spots";

export type ToggleResult =
  | { ok: true; favorited: boolean }
  | { ok: false; reason: "limit_reached" | "unauthenticated" | "error"; message: string };

export async function fetchUserFavoriteSpots(
  supabase: TypedSupabaseClient,
  userId: string,
): Promise<Spot[]> {
  const { data: favs } = await supabase
    .from("favorite_spots")
    .select("spot_id")
    .eq("user_id", userId);
  if (!favs || favs.length === 0) return [];

  const { data: rows } = await supabase
    .from("spots")
    .select("*")
    .in("id", favs.map((f) => f.spot_id))
    .eq("active", true)
    .order("name");

  return (rows ?? []).map(dbRowToSpot);
}

export async function fetchFavoriteSpotIds(
  supabase: TypedSupabaseClient,
  userId: string,
): Promise<Set<string>> {
  const { data } = await supabase
    .from("favorite_spots")
    .select("spot_id")
    .eq("user_id", userId);
  return new Set((data ?? []).map((r) => r.spot_id));
}

export async function isSpotFavorited(
  supabase: TypedSupabaseClient,
  userId: string,
  spotId: string,
): Promise<boolean> {
  const { data } = await supabase
    .from("favorite_spots")
    .select("spot_id")
    .eq("user_id", userId)
    .eq("spot_id", spotId)
    .maybeSingle();
  return data !== null;
}

export async function addFavorite(
  supabase: TypedSupabaseClient,
  userId: string,
  spotId: string,
): Promise<ToggleResult> {
  const { error } = await supabase
    .from("favorite_spots")
    .insert({ user_id: userId, spot_id: spotId });

  if (!error) return { ok: true, favorited: true };

  // Our DB trigger throws P0001 with a FREE_TIER_LIMIT prefix when a free-tier
  // user tries to add a second favorite.
  if (error.code === "P0001" || error.message.includes("FREE_TIER_LIMIT")) {
    return { ok: false, reason: "limit_reached", message: error.message };
  }
  return { ok: false, reason: "error", message: error.message };
}

export async function removeFavorite(
  supabase: TypedSupabaseClient,
  userId: string,
  spotId: string,
): Promise<ToggleResult> {
  const { error } = await supabase
    .from("favorite_spots")
    .delete()
    .eq("user_id", userId)
    .eq("spot_id", spotId);
  if (error) return { ok: false, reason: "error", message: error.message };
  return { ok: true, favorited: false };
}
