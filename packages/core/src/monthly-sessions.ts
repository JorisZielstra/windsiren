import type { TypedSupabaseClient } from "@windsiren/supabase";

export type MonthlySessionsBucket = {
  // "YYYY-MM" — the calendar month (NL local).
  monthKey: string;
  sessionCount: number;
  totalMinutes: number;
};

// Returns one bucket per calendar month for the last `months` months,
// ending with the current month (NL local). Empty months are returned
// with sessionCount = 0 / totalMinutes = 0 so the chart can render the
// gap as a flat bar instead of leaving holes in the axis.
//
// Implementation: one query for the user's session_date + duration over
// the relevant date range, then bucket client-side. Cheap at v0.1
// cardinality. Move to a Postgres aggregate when usage grows.
export async function getMonthlySessions(
  supabase: TypedSupabaseClient,
  userId: string,
  months: number = 12,
  now: Date = new Date(),
): Promise<MonthlySessionsBucket[]> {
  const buckets = buildEmptyBuckets(months, now);
  const earliest = buckets[0]?.monthKey ?? null;
  if (!earliest) return [];

  const { data } = await supabase
    .from("sessions")
    .select("session_date, duration_minutes")
    .eq("user_id", userId)
    // session_date is "YYYY-MM-DD"; lexicographic >= the bucket's
    // first-day key matches every session in or after that month.
    .gte("session_date", `${earliest}-01`);

  const byKey = new Map<string, MonthlySessionsBucket>();
  for (const b of buckets) byKey.set(b.monthKey, b);

  for (const row of data ?? []) {
    const key = (row.session_date as string).slice(0, 7); // YYYY-MM
    const bucket = byKey.get(key);
    if (!bucket) continue; // session before the rolling window
    bucket.sessionCount += 1;
    bucket.totalMinutes += row.duration_minutes ?? 0;
  }

  return buckets;
}

function buildEmptyBuckets(months: number, now: Date): MonthlySessionsBucket[] {
  const out: MonthlySessionsBucket[] = [];
  // Walk backwards from the current month using UTC to dodge local-TZ
  // boundary shifts. Output is ascending (oldest → newest), matching how
  // the chart reads left-to-right.
  const baseYear = now.getUTCFullYear();
  const baseMonth = now.getUTCMonth(); // 0-indexed
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(baseYear, baseMonth - i, 1));
    const yyyy = d.getUTCFullYear();
    const mm = (d.getUTCMonth() + 1).toString().padStart(2, "0");
    out.push({
      monthKey: `${yyyy}-${mm}`,
      sessionCount: 0,
      totalMinutes: 0,
    });
  }
  return out;
}
