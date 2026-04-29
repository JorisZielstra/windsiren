export { createClient, type TypedSupabaseClient } from "./client";
export type {
  Database,
  Json,
  SpotRow,
  UserRow,
  FavoriteSpotRow,
  RsvpRow,
  ForecastRow,
  ObservationRow,
  TideEventRow,
  SubscriptionRow,
  FollowRow,
  SessionRow,
  LikeRow,
  SessionPhotoRow,
  SessionCommentRow,
  SessionTrackRow,
} from "./database.types";
// Re-export auth types so apps don't need a direct dep on @supabase/supabase-js.
export type { Session, User, AuthError } from "@supabase/supabase-js";
