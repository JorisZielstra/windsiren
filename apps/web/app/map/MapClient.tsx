"use client";

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { MapContainer, Marker, Popup, TileLayer } from "react-leaflet";

export type MapItem = {
  id: string;
  slug: string;
  name: string;
  lat: number;
  lng: number;
  tideSensitive: boolean;
  decision: "go" | "marginal" | "no_go" | null;
};

const COLORS: Record<"go" | "marginal" | "no_go" | "unknown", string> = {
  go: "#0fb89a",       // --ws-go
  marginal: "#d88b3d", // --ws-maybe
  no_go: "#7e8a91",    // --ws-no-go
  unknown: "#a7b2b9",  // --ws-ink-faint
};

function makeIcon(decision: MapItem["decision"]): L.DivIcon {
  const color = COLORS[decision ?? "unknown"];
  // Two-ring pin: outer halo softens the marker against the paper base,
  // inner dot carries the verdict color. Drop shadow keeps it readable
  // over both the warm land and the brand-soft water.
  const html = `<div style="
    width: 22px; height: 22px;
    border-radius: 50%;
    background: rgba(11, 46, 63, 0.08);
    display: flex; align-items: center; justify-content: center;
  "><div style="
    width: 14px; height: 14px;
    border-radius: 50%;
    background: ${color};
    border: 2px solid #faf8f2;
    box-shadow: 0 1px 3px rgba(11, 46, 63, 0.35);
  "></div></div>`;
  return L.divIcon({
    html,
    className: "",
    iconSize: [22, 22],
    iconAnchor: [11, 11],
  });
}

const NL_CENTER: [number, number] = [52.7, 4.9];

// Watch the <html> class list so the map swaps to dark Carto tiles when
// the user toggles theme via the global picker. Same pattern the rest of
// the app relies on (theme-light / theme-dark applied at script time).
function useIsDark(): boolean {
  const [isDark, setIsDark] = useState(false);
  useEffect(() => {
    if (typeof document === "undefined") return;
    const el = document.documentElement;
    const update = () => setIsDark(el.classList.contains("theme-dark"));
    update();
    const obs = new MutationObserver(update);
    obs.observe(el, { attributes: true, attributeFilter: ["class"] });
    return () => obs.disconnect();
  }, []);
  return isDark;
}

export function MapClient({ items }: { items: MapItem[] }) {
  const isDark = useIsDark();

  const icons = useMemo(() => {
    const map = new Map<string, L.DivIcon>();
    for (const d of ["go", "marginal", "no_go", "unknown"] as const) {
      map.set(d, makeIcon(d === "unknown" ? null : d));
    }
    return map;
  }, []);

  const baseUrl = isDark
    ? "https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png"
    : "https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png";
  const labelsUrl = isDark
    ? "https://{s}.basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}{r}.png"
    : "https://{s}.basemaps.cartocdn.com/light_only_labels/{z}/{x}/{y}{r}.png";
  const attribution =
    '&copy; <a href="https://osm.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>';

  return (
    <MapContainer
      center={NL_CENTER}
      zoom={8}
      style={{ height: "100vh", width: "100%", background: "var(--ws-paper-sunk)" }}
      scrollWheelZoom
    >
      {/* Base land/water layer — Positron is near-monochrome and label-free
          so the colored pins do the talking. The className lets globals.css
          warm the tiles toward the paper palette without touching markers. */}
      <TileLayer
        key={`base-${isDark ? "dark" : "light"}`}
        attribution={attribution}
        url={baseUrl}
        className={isDark ? "ws-map-base ws-map-base--dark" : "ws-map-base"}
        detectRetina
      />
      {/* Sparse city/region anchors. Kept on a separate layer so the
          warming filter on the base doesn't muddy the label text. */}
      <TileLayer
        key={`labels-${isDark ? "dark" : "light"}`}
        url={labelsUrl}
        className="ws-map-labels"
        detectRetina
      />
      {items.map((item) => (
        <Marker
          key={item.id}
          position={[item.lat, item.lng]}
          icon={icons.get(item.decision ?? "unknown")}
        >
          <Popup>
            <div className="min-w-40">
              <div className="font-semibold">{item.name}</div>
              <div className="mt-0.5 text-xs text-zinc-600">
                {item.decision === "go"
                  ? "GO today"
                  : item.decision === "marginal"
                    ? "Maybe today"
                    : item.decision === "no_go"
                      ? "No go today"
                      : "Condition unknown"}
                {item.tideSensitive ? " · tide sensitive" : ""}
              </div>
              <Link
                href={`/spots/${item.slug}`}
                className="mt-2 inline-block text-sm text-blue-600 underline"
              >
                View detail →
              </Link>
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
