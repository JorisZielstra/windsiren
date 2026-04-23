import { supabase } from "@/lib/supabase";

export default async function Home() {
  const { data: spots, error } = await supabase
    .from("spots")
    .select("id, slug, name, lat, lng, tide_sensitive, hazards")
    .eq("active", true)
    .order("name");

  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <header className="mb-10">
        <h1 className="text-4xl font-bold tracking-tight">WindSiren</h1>
        <p className="mt-2 text-zinc-600 dark:text-zinc-400">
          {error
            ? "Failed to load spots"
            : `${spots?.length ?? 0} curated NL kitesurf spots`}
        </p>
      </header>

      {error ? (
        <div className="rounded-md border border-red-300 bg-red-50 p-4 text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
          <p className="font-medium">Supabase query failed</p>
          <p className="mt-1 text-sm">{error.message}</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {spots?.map((spot) => (
            <li
              key={spot.id}
              className="flex items-center justify-between rounded-md border border-zinc-200 px-4 py-3 dark:border-zinc-800"
            >
              <div>
                <div className="font-medium">{spot.name}</div>
                <div className="mt-0.5 text-xs text-zinc-500">
                  {spot.lat.toFixed(3)}°N, {spot.lng.toFixed(3)}°E
                </div>
              </div>
              {spot.tide_sensitive ? (
                <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                  Tide sensitive
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
