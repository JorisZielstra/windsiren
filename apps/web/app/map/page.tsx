import { supabase } from "@/lib/supabase";
import { dbRowToSpot, fetchTodayVerdict } from "@windsiren/core";
import Link from "next/link";
import { MapClient } from "./MapClient";

export const dynamic = "force-dynamic";

export default async function MapPage() {
  const { data: rows, error } = await supabase
    .from("spots")
    .select("*")
    .eq("active", true);

  if (error) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-16">
        <h1 className="text-3xl font-bold">WindSiren — Map</h1>
        <p className="mt-4 text-red-600">Failed to load spots: {error.message}</p>
      </main>
    );
  }

  const spots = (rows ?? []).map(dbRowToSpot);
  const withVerdicts = await Promise.all(spots.map(fetchTodayVerdict));

  const mapItems = withVerdicts.map(({ spot, verdict }) => ({
    id: spot.id,
    slug: spot.slug,
    name: spot.name,
    lat: spot.lat,
    lng: spot.lng,
    tideSensitive: spot.tideSensitive,
    decision: verdict?.decision ?? null,
  }));

  return (
    <main className="relative h-screen">
      <header className="absolute left-4 top-4 z-[1000] rounded-lg bg-white/95 px-4 py-2 shadow-md backdrop-blur dark:bg-zinc-900/95">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
          >
            ← List
          </Link>
          <span className="text-sm font-semibold">WindSiren — Map</span>
          <span className="text-xs text-zinc-500">today</span>
        </div>
      </header>
      <MapClient items={mapItems} />
    </main>
  );
}
