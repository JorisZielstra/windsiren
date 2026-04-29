"use client";

import { useState } from "react";
import { cardinalDirection, msToKnots, windKnColor, type Spot } from "@windsiren/shared";
import type { LiveObservation } from "@windsiren/core";
import { LiveHistoryModal } from "@/components/LiveHistoryModal";

// The Live block on the spot detail page. The whole card is the click
// target — kiters expect "tap live wind to see how it got here," and
// the explicit "Past 24h" pill remains as a discoverable affordance for
// anyone scanning. Both surfaces open the same modal.
//
// Layout matches the surrounding CollapsibleSections (same paddings,
// same title typography) so it sits flush at the top of the panels card.
export function LiveObservationCard({
  live,
  spot,
}: {
  live: LiveObservation;
  spot: Pick<Spot, "lat" | "lng" | "name">;
}) {
  const [open, setOpen] = useState(false);
  const stale = live.ageMinutes > 20;

  return (
    <>
      <div
        role="button"
        tabIndex={0}
        onClick={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setOpen(true);
          }
        }}
        aria-label={`Show past 24 hours of wind at ${spot.name}`}
        className="group cursor-pointer transition-colors hover:bg-paper-sunk/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
      >
        <div className="flex items-start justify-between gap-3 px-6 py-4">
          <div className="min-w-0 flex-1">
            <p className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-ink-mute">
              Live — KNMI station {live.observation.stationId}
            </p>
            <p className={`mt-1 text-[11px] ${stale ? "text-maybe" : "text-ink-mute"}`}>
              {live.ageMinutes === 0 ? "just now" : `${live.ageMinutes} min ago`}
              {stale ? " · stale" : ""}
              <span className="ml-2 text-ink-faint">· tap for past 24h</span>
            </p>
          </div>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setOpen(true);
            }}
            className="shrink-0 rounded-md border border-border bg-paper-2 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-ink-2 transition-colors group-hover:border-border-strong hover:border-border-strong hover:text-ink"
          >
            Past 24h ↗
          </button>
        </div>
        <div className="px-6 pb-4">
          <div className="flex flex-wrap gap-6">
            <Stat
              label="Wind"
              value={`${msToKn(live.observation.windSpeedMs)} kn`}
              sub={cardinalDirection(live.observation.windDirectionDeg)}
              kn={msToKnots(live.observation.windSpeedMs)}
            />
            <Stat
              label="Gust"
              value={`${msToKn(live.observation.gustMs)} kn`}
              kn={msToKnots(live.observation.gustMs)}
            />
            <Stat label="Dir" value={`${Math.round(live.observation.windDirectionDeg)}°`} />
            {live.observation.airTempC !== null ? (
              <Stat label="Air" value={`${live.observation.airTempC.toFixed(0)}°C`} />
            ) : null}
            {live.observation.pressureHpa !== null ? (
              <Stat
                label="Pressure"
                value={`${live.observation.pressureHpa.toFixed(0)} hPa`}
              />
            ) : null}
          </div>
        </div>
      </div>
      {open ? (
        <LiveHistoryModal spot={spot} onClose={() => setOpen(false)} />
      ) : null}
    </>
  );
}

function Stat({
  label,
  value,
  sub,
  kn,
}: {
  label: string;
  value: string;
  sub?: string;
  kn?: number;
}) {
  const tint = kn !== undefined ? windKnColor(kn) : null;
  return (
    <div>
      <div className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-ink-mute">
        {label}
      </div>
      <div className="mt-1 flex items-baseline gap-1.5">
        {tint ? (
          <span
            style={{ backgroundColor: tint.bg, color: tint.fg }}
            className="headline rounded-lg px-2.5 py-0.5 font-mono text-xl"
          >
            {value}
          </span>
        ) : (
          <span className="headline font-mono text-xl text-ink">{value}</span>
        )}
        {sub ? <span className="text-xs text-ink-mute">{sub}</span> : null}
      </div>
    </div>
  );
}

function msToKn(ms: number): string {
  return msToKnots(ms).toFixed(0);
}
