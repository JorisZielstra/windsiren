import { cardinalDirection, msToKnots } from "@windsiren/shared";
import type { SessionRow } from "@windsiren/supabase";

type Props = {
  session: Pick<SessionRow, "wind_avg_ms" | "wind_max_ms" | "wind_dir_avg_deg" | "gust_max_ms">;
};

// Compact "wind during this session" chip. Renders nothing when the row
// has no wind data (e.g. backdated sessions logged before the column existed).
export function SessionWindChip({ session }: Props) {
  if (session.wind_avg_ms == null) return null;
  const avgKn = Math.round(msToKnots(session.wind_avg_ms));
  const dir =
    session.wind_dir_avg_deg != null ? cardinalDirection(session.wind_dir_avg_deg) : null;
  const gustKn =
    session.gust_max_ms != null ? Math.round(msToKnots(session.gust_max_ms)) : null;
  return (
    <span className="inline-flex items-center gap-1 rounded-md bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
      <span className="font-mono">{avgKn} kn</span>
      {dir ? <span className="text-zinc-500">{dir}</span> : null}
      {gustKn !== null ? (
        <>
          <span className="text-zinc-400">·</span>
          <span className="text-zinc-500">gust</span>
          <span className="font-mono">{gustKn}</span>
        </>
      ) : null}
    </span>
  );
}
