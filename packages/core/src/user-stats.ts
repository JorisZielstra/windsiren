import type { SessionRow, TypedSupabaseClient } from "@windsiren/supabase";

export type UserStats = {
  sessionCount: number;
  totalMinutes: number;
  longestSessionMinutes: number | null;
  // m/s — both biggest *gust* and biggest *avg* wind, since some kiters
  // care more about average power than peak gust.
  biggestGustMs: number | null;
  biggestAvgWindMs: number | null;
  biggestJumpM: number | null;
  // The spot the user has logged the most sessions at, with its count.
  // Null when the user has no sessions yet.
  topSpot: { spotId: string; sessionCount: number } | null;
  lastSessionDate: string | null;
};

export const EMPTY_USER_STATS: UserStats = {
  sessionCount: 0,
  totalMinutes: 0,
  longestSessionMinutes: null,
  biggestGustMs: null,
  biggestAvgWindMs: null,
  biggestJumpM: null,
  topSpot: null,
  lastSessionDate: null,
};

// Aggregates lifetime stats from a user's sessions for the profile-page
// stats panel (Strava-style "biggest jump / longest session / total time").
//
// Implementation: client-side reduce over every session this user has logged.
// Cheap at v0.1 user scale; if a kiter ever logs thousands of sessions we'd
// move this to a Postgres view or materialized stats table.
export async function getUserStats(
  supabase: TypedSupabaseClient,
  userId: string,
): Promise<UserStats> {
  // Pull the columns we actually need — keeps the network payload small if
  // the user has hundreds of sessions.
  const { data } = await supabase
    .from("sessions")
    .select(
      "spot_id, session_date, duration_minutes, wind_avg_ms, gust_max_ms, max_jump_m",
    )
    .eq("user_id", userId);

  const rows = (data ?? []) as Array<
    Pick<
      SessionRow,
      | "spot_id"
      | "session_date"
      | "duration_minutes"
      | "wind_avg_ms"
      | "gust_max_ms"
      | "max_jump_m"
    >
  >;

  if (rows.length === 0) return EMPTY_USER_STATS;

  let totalMinutes = 0;
  let longestSessionMinutes: number | null = null;
  let biggestGustMs: number | null = null;
  let biggestAvgWindMs: number | null = null;
  let biggestJumpM: number | null = null;
  let lastSessionDate: string | null = null;
  const spotCounts = new Map<string, number>();

  for (const row of rows) {
    totalMinutes += row.duration_minutes;
    longestSessionMinutes =
      longestSessionMinutes === null
        ? row.duration_minutes
        : Math.max(longestSessionMinutes, row.duration_minutes);

    if (row.gust_max_ms != null) {
      biggestGustMs =
        biggestGustMs === null ? row.gust_max_ms : Math.max(biggestGustMs, row.gust_max_ms);
    }
    if (row.wind_avg_ms != null) {
      biggestAvgWindMs =
        biggestAvgWindMs === null
          ? row.wind_avg_ms
          : Math.max(biggestAvgWindMs, row.wind_avg_ms);
    }
    if (row.max_jump_m != null) {
      biggestJumpM =
        biggestJumpM === null ? row.max_jump_m : Math.max(biggestJumpM, row.max_jump_m);
    }
    if (lastSessionDate === null || row.session_date > lastSessionDate) {
      lastSessionDate = row.session_date;
    }

    spotCounts.set(row.spot_id, (spotCounts.get(row.spot_id) ?? 0) + 1);
  }

  let topSpot: UserStats["topSpot"] = null;
  for (const [spotId, count] of spotCounts) {
    if (topSpot === null || count > topSpot.sessionCount) {
      topSpot = { spotId, sessionCount: count };
    }
  }

  return {
    sessionCount: rows.length,
    totalMinutes,
    longestSessionMinutes,
    biggestGustMs,
    biggestAvgWindMs,
    biggestJumpM,
    topSpot,
    lastSessionDate,
  };
}
