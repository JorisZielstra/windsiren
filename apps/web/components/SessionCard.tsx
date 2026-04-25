import Link from "next/link";
import { needleEndpoint } from "@windsiren/core";
import { cardinalDirection, msToKnots } from "@windsiren/shared";
import type { SessionRow } from "@windsiren/supabase";
import { CommentSection } from "@/components/CommentSection";
import { LikeButton } from "@/components/LikeButton";
import { PhotoGrid } from "@/components/PhotoGrid";

type Props = {
  session: SessionRow;
  authorId: string;
  authorName: string;
  spot: { name: string; slug: string } | null;
  showAuthor?: boolean;
  showSpot?: boolean;
  createdAtRelative: string;
  photoUrls: string[];
  likeCount: number;
  liked: boolean;
  commentCount: number;
  viewerId?: string;
};

export function SessionCard({
  session,
  authorId,
  authorName,
  spot,
  showAuthor = true,
  showSpot = true,
  createdAtRelative,
  photoUrls,
  likeCount,
  liked,
  commentCount,
  viewerId,
}: Props) {
  const dateLabel = new Date(session.session_date).toLocaleDateString("en-NL", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });

  return (
    <li className="overflow-hidden rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
      {/* Header: author + spot, date + posted-at */}
      <div className="flex items-start justify-between gap-2 px-4 pt-3">
        <div className="min-w-0 text-sm">
          {showAuthor ? (
            <Link
              href={`/users/${authorId}`}
              className="font-semibold hover:underline"
            >
              {authorName}
            </Link>
          ) : null}
          {showAuthor && showSpot && spot ? (
            <span className="text-zinc-400"> · </span>
          ) : null}
          {showSpot && spot ? (
            <Link href={`/spots/${spot.slug}`} className="font-medium hover:underline">
              {spot.name}
            </Link>
          ) : null}
        </div>
        <div className="shrink-0 text-xs text-zinc-500">{createdAtRelative}</div>
      </div>
      <div className="px-4 pt-0.5 text-xs text-zinc-500">{dateLabel}</div>

      {/* Wind hero */}
      <SessionWindHero session={session} />

      {/* Notes */}
      {session.notes ? (
        <p className="px-4 pb-3 text-sm text-zinc-700 dark:text-zinc-300">
          {session.notes}
        </p>
      ) : null}

      {/* Photos (demoted from hero) */}
      {photoUrls.length > 0 ? (
        <div className="px-4 pb-3">
          <PhotoGrid urls={photoUrls} />
        </div>
      ) : null}

      {/* Reactions */}
      <div className="border-t border-zinc-100 px-4 py-2 dark:border-zinc-900">
        <LikeButton
          sessionId={session.id}
          initialCount={likeCount}
          initialLiked={liked}
          viewerId={viewerId ?? null}
        />
        <CommentSection
          sessionId={session.id}
          initialCount={commentCount}
          viewerId={viewerId ?? null}
        />
      </div>
    </li>
  );
}

// Hero block: avg kn (accent) · gust kn · direction needle · duration min.
// Falls back to a duration-only strip when the session has no wind data
// (e.g. backdated sessions).
function SessionWindHero({
  session,
}: {
  session: Pick<
    SessionRow,
    "wind_avg_ms" | "wind_max_ms" | "wind_dir_avg_deg" | "gust_max_ms" | "duration_minutes"
  >;
}) {
  const dur = session.duration_minutes;
  if (session.wind_avg_ms == null) {
    return (
      <div className="mt-3 flex items-baseline gap-2 px-4 pb-3">
        <span className="font-mono text-3xl font-bold tracking-tight">{dur}</span>
        <span className="text-sm text-zinc-500">min</span>
        <span className="ml-auto text-xs text-zinc-400">no wind data</span>
      </div>
    );
  }
  const avgKn = Math.round(msToKnots(session.wind_avg_ms));
  const gustKn =
    session.gust_max_ms != null ? Math.round(msToKnots(session.gust_max_ms)) : null;
  const dirDeg = session.wind_dir_avg_deg ?? null;
  const dirLabel = dirDeg != null ? cardinalDirection(dirDeg) : null;

  return (
    <div className="mt-3 grid grid-cols-[auto_auto_auto_1fr] items-end gap-x-6 gap-y-1 px-4 pb-3">
      <Stat value={avgKn} unit="kn" label="avg" accent />
      {gustKn !== null ? <Stat value={gustKn} unit="kn" label="gust" /> : <div />}
      {dirDeg != null ? (
        <div className="flex items-center gap-2">
          <DirectionNeedle directionDeg={dirDeg} size={44} />
          <div className="leading-tight">
            <div className="font-mono text-xl font-bold tracking-tight">{dirLabel}</div>
            <div className="text-[10px] uppercase tracking-wide text-zinc-500">
              {Math.round(dirDeg)}°
            </div>
          </div>
        </div>
      ) : (
        <div />
      )}
      <Stat value={dur} unit="min" label="duration" align="right" />
    </div>
  );
}

function Stat({
  value,
  unit,
  label,
  accent = false,
  align = "left",
}: {
  value: number;
  unit: string;
  label: string;
  accent?: boolean;
  align?: "left" | "right";
}) {
  return (
    <div className={align === "right" ? "text-right" : "text-left"}>
      <div className="leading-none">
        <span
          className={[
            "font-mono text-3xl font-bold tracking-tight",
            accent ? "text-emerald-600 dark:text-emerald-400" : "",
          ].join(" ")}
        >
          {value}
        </span>
        <span className="ml-1 text-sm text-zinc-500">{unit}</span>
      </div>
      <div className="mt-1 text-[10px] uppercase tracking-wide text-zinc-500">
        {label}
      </div>
    </div>
  );
}

// Compact "where the wind came from" needle. Reuses the same geometry as the
// spot-page WindRose so the visual language stays consistent across the app.
function DirectionNeedle({
  directionDeg,
  size,
}: {
  directionDeg: number;
  size: number;
}) {
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 2;
  const tip = needleEndpoint(cx, cy, r - 3, directionDeg);
  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      role="img"
      aria-label={`Wind direction ${Math.round(directionDeg)}°`}
    >
      <circle
        cx={cx}
        cy={cy}
        r={r}
        className="fill-zinc-50 stroke-zinc-200 dark:fill-zinc-900 dark:stroke-zinc-800"
        strokeWidth="1"
      />
      {[0, 90, 180, 270].map((deg) => {
        const inner = cy - r + 2;
        const tickEnd = cy - r + 5;
        return (
          <line
            key={deg}
            x1={cx}
            y1={inner}
            x2={cx}
            y2={tickEnd}
            className="stroke-zinc-300 dark:stroke-zinc-700"
            strokeWidth="1"
            transform={`rotate(${deg} ${cx} ${cy})`}
          />
        );
      })}
      <line
        x1={cx}
        y1={cy}
        x2={tip.x}
        y2={tip.y}
        className="stroke-emerald-600 dark:stroke-emerald-400"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <circle
        cx={tip.x}
        cy={tip.y}
        r="2"
        className="fill-emerald-600 dark:fill-emerald-400"
      />
      <circle cx={cx} cy={cy} r="1.5" className="fill-zinc-400 dark:fill-zinc-600" />
    </svg>
  );
}
