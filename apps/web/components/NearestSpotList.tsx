"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { VerdictBadge } from "@/components/VerdictBadge";

export type NearestItem = {
  id: string;
  slug: string;
  name: string;
  lat: number;
  lng: number;
  region: string | null;
  tideSensitive: boolean;
  decision: "go" | "marginal" | "no_go" | null;
  peakKn: number | null;
};

const REGION_LABEL: Record<string, string> = {
  wadden: "Wadden",
  north_holland: "North Holland",
  south_holland: "South Holland",
  zeeland: "Zeeland",
  ijsselmeer: "IJsselmeer",
};

// Renders the spots list ordered by haversine distance from the user's
// current geolocation. Geolocation is opt-in: the list is empty/CTA
// until the user grants permission via the "Use my location" button,
// which is the right UX for an optional sort mode.
export function NearestSpotList({ items }: { items: NearestItem[] }) {
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const sorted = useMemo(() => {
    if (!coords) return items;
    return [...items].sort(
      (a, b) =>
        haversineKm(coords.lat, coords.lng, a.lat, a.lng) -
        haversineKm(coords.lat, coords.lng, b.lat, b.lng),
    );
  }, [items, coords]);

  function requestLocation() {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setError("Geolocation is not supported in this browser.");
      return;
    }
    setLoading(true);
    setError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLoading(false);
      },
      (err) => {
        setError(err.message || "Couldn't read location.");
        setLoading(false);
      },
      { maximumAge: 5 * 60 * 1000, timeout: 10_000 },
    );
  }

  return (
    <div className="mt-6">
      {coords ? null : (
        <div className="mb-4 flex items-center justify-between gap-3 rounded-md border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm dark:border-zinc-800 dark:bg-zinc-900">
          <span className="text-zinc-600 dark:text-zinc-400">
            Allow location access to sort spots by distance.
          </span>
          <button
            type="button"
            onClick={requestLocation}
            disabled={loading}
            className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-emerald-700 disabled:opacity-50"
          >
            {loading ? "Locating…" : "Use my location"}
          </button>
        </div>
      )}
      {error ? (
        <p className="mb-3 text-xs text-amber-600 dark:text-amber-400">{error}</p>
      ) : null}

      <ul className="space-y-2">
        {sorted.map((item) => {
          const distKm = coords
            ? haversineKm(coords.lat, coords.lng, item.lat, item.lng)
            : null;
          return (
            <li
              key={item.id}
              className="flex items-center justify-between rounded-md border border-zinc-200 px-4 py-3 transition-colors hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:border-zinc-700 dark:hover:bg-zinc-900"
            >
              <Link href={`/spots/${item.slug}`} className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{item.name}</span>
                  {item.tideSensitive ? (
                    <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                      Tide
                    </span>
                  ) : null}
                  {item.region ? (
                    <span className="text-xs text-zinc-500">
                      {REGION_LABEL[item.region] ?? item.region}
                    </span>
                  ) : null}
                </div>
                <div className="mt-0.5 text-xs text-zinc-500">
                  {item.lat.toFixed(3)}°N, {item.lng.toFixed(3)}°E
                  {distKm !== null ? (
                    <>
                      {" · "}
                      <span className="font-mono">{distKm.toFixed(1)} km</span>
                    </>
                  ) : null}
                  {item.peakKn !== null ? (
                    <>
                      {" · "}
                      peak <span className="font-mono">{item.peakKn.toFixed(0)} kn</span>
                    </>
                  ) : null}
                </div>
              </Link>
              <VerdictBadge
                verdict={
                  item.decision === null
                    ? null
                    : { decision: item.decision, reasons: [] }
                }
              />
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}
