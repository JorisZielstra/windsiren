"use client";

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useMemo } from "react";
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
  go: "#10b981",       // emerald
  marginal: "#f59e0b", // amber
  no_go: "#71717a",    // zinc
  unknown: "#d4d4d8",  // light zinc
};

function makeIcon(decision: MapItem["decision"]): L.DivIcon {
  const color = COLORS[decision ?? "unknown"];
  const html = `<div style="
    width: 18px; height: 18px;
    border-radius: 50%;
    background: ${color};
    border: 2px solid white;
    box-shadow: 0 1px 3px rgba(0,0,0,0.35);
  "></div>`;
  return L.divIcon({
    html,
    className: "",
    iconSize: [18, 18],
    iconAnchor: [9, 9],
  });
}

// NL-centered bounds: covers all coastal + IJsselmeer kite spots with a bit of margin.
const NL_CENTER: [number, number] = [52.7, 4.9];

export function MapClient({ items }: { items: MapItem[] }) {
  const icons = useMemo(() => {
    const map = new Map<string, L.DivIcon>();
    for (const d of ["go", "marginal", "no_go", "unknown"] as const) {
      map.set(d, makeIcon(d === "unknown" ? null : d));
    }
    return map;
  }, []);

  return (
    <MapContainer
      center={NL_CENTER}
      zoom={8}
      style={{ height: "100vh", width: "100%" }}
      scrollWheelZoom
    >
      <TileLayer
        attribution='&copy; <a href="https://osm.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
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
