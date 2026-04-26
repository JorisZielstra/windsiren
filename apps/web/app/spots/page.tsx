import Link from "next/link";
import { supabase } from "@/lib/supabase";
import {
  dbRowToSpot,
  fetchSpotWeek,
  peakWindMs,
  type SpotWithVerdict,
} from "@windsiren/core";
import {
  directionInAnyRange,
  msToKnots,
  type SpotRegion,
} from "@windsiren/shared";
import { VerdictBadge } from "@/components/VerdictBadge";

export const dynamic = "force-dynamic";

const DIRECTIONS: { label: string; deg: number }[] = [
  { label: "N", deg: 0 },
  { label: "NE", deg: 45 },
  { label: "E", deg: 90 },
  { label: "SE", deg: 135 },
  { label: "S", deg: 180 },
  { label: "SW", deg: 225 },
  { label: "W", deg: 270 },
  { label: "NW", deg: 315 },
];

const REGIONS: { value: SpotRegion; label: string }[] = [
  { value: "wadden", label: "Wadden" },
  { value: "north_holland", label: "North Holland" },
  { value: "south_holland", label: "South Holland" },
  { value: "zeeland", label: "Zeeland" },
  { value: "ijsselmeer", label: "IJsselmeer" },
];

type Search = {
  dir?: string | string[];
  tide?: string;
  region?: string;
};

export default async function SpotsPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const params = await searchParams;

  const selectedDirs = parseDirs(params.dir);
  const tideFilter = parseTide(params.tide);
  const regionFilter = parseRegion(params.region);

  const { data: rows, error } = await supabase
    .from("spots")
    .select("*")
    .eq("active", true)
    .order("name");

  if (error) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-12">
        <h1 className="text-3xl font-bold tracking-tight">Spots</h1>
        <div className="mt-6 rounded-md border border-red-300 bg-red-50 p-4 text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
          <p className="font-medium">Failed to load spots</p>
          <p className="mt-1 text-sm">{error.message}</p>
        </div>
      </main>
    );
  }

  const spots = (rows ?? []).map(dbRowToSpot);
  const todayKey = nlLocalDateKey(new Date());
  const spotWeeks = await Promise.all(spots.map((s) => fetchSpotWeek(s, 1)));
  const items: SpotWithVerdict[] = spotWeeks.map((week) => {
    const today = week.days.find((d) => d.dateKey === todayKey) ?? week.days[0];
    return {
      spot: week.spot,
      verdict: today?.verdict ?? null,
      hours: today?.hours ?? [],
    };
  });

  // Apply filters.
  const filtered = items.filter((it) => {
    if (regionFilter && it.spot.region !== regionFilter) return false;
    if (tideFilter === "only_tide" && !it.spot.tideSensitive) return false;
    if (tideFilter === "only_no_tide" && it.spot.tideSensitive) return false;
    if (selectedDirs.size > 0) {
      const matchesAny = Array.from(selectedDirs).some((deg) =>
        directionInAnyRange(deg, it.spot.safeWindDirections),
      );
      if (!matchesAny) return false;
    }
    return true;
  });

  // Sort: GO → MAYBE → NO_GO → no data; alphabetical within each.
  const score = (item: SpotWithVerdict): number => {
    if (item.verdict?.decision === "go") return 3;
    if (item.verdict?.decision === "marginal") return 2;
    if (item.verdict?.decision === "no_go") return 1;
    return 0;
  };
  const sorted = [...filtered].sort((a, b) => {
    const d = score(b) - score(a);
    if (d !== 0) return d;
    return a.spot.name.localeCompare(b.spot.name);
  });

  const filtersActive =
    selectedDirs.size > 0 || tideFilter !== "any" || regionFilter !== null;

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="text-3xl font-bold tracking-tight">Spots</h1>
      <p className="mt-1 text-sm text-zinc-500">
        {filtered.length} of {items.length} NL spots
        {filtersActive ? " match your filters" : ""}
      </p>

      <FiltersBar
        selectedDirs={selectedDirs}
        tideFilter={tideFilter}
        regionFilter={regionFilter}
      />

      {sorted.length === 0 ? (
        <div className="mt-8 rounded-md border border-zinc-200 px-4 py-8 text-center text-sm text-zinc-500 dark:border-zinc-800">
          No spots match these filters.{" "}
          <Link href="/spots" className="underline">
            Clear filters
          </Link>
        </div>
      ) : (
        <ul className="mt-6 space-y-2">
          {sorted.map((item) => (
            <SpotRow key={item.spot.id} item={item} />
          ))}
        </ul>
      )}
    </main>
  );
}

function FiltersBar({
  selectedDirs,
  tideFilter,
  regionFilter,
}: {
  selectedDirs: Set<number>;
  tideFilter: "any" | "only_tide" | "only_no_tide";
  regionFilter: SpotRegion | null;
}) {
  return (
    <div className="mt-6 space-y-3">
      <FilterGroup label="Wind direction">
        {DIRECTIONS.map((d) => (
          <DirChip
            key={d.label}
            label={d.label}
            deg={d.deg}
            selectedDirs={selectedDirs}
            tideFilter={tideFilter}
            regionFilter={regionFilter}
          />
        ))}
      </FilterGroup>
      <FilterGroup label="Tide">
        <TideChip
          label="Any"
          value="any"
          active={tideFilter === "any"}
          selectedDirs={selectedDirs}
          regionFilter={regionFilter}
        />
        <TideChip
          label="Tide-sensitive"
          value="only_tide"
          active={tideFilter === "only_tide"}
          selectedDirs={selectedDirs}
          regionFilter={regionFilter}
        />
        <TideChip
          label="Inland / no tide"
          value="only_no_tide"
          active={tideFilter === "only_no_tide"}
          selectedDirs={selectedDirs}
          regionFilter={regionFilter}
        />
      </FilterGroup>
      <FilterGroup label="Region">
        <RegionChip
          label="All"
          value={null}
          active={regionFilter === null}
          selectedDirs={selectedDirs}
          tideFilter={tideFilter}
        />
        {REGIONS.map((r) => (
          <RegionChip
            key={r.value}
            label={r.label}
            value={r.value}
            active={regionFilter === r.value}
            selectedDirs={selectedDirs}
            tideFilter={tideFilter}
          />
        ))}
      </FilterGroup>
    </div>
  );
}

function FilterGroup({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
        {label}
      </p>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}

function DirChip({
  label,
  deg,
  selectedDirs,
  tideFilter,
  regionFilter,
}: {
  label: string;
  deg: number;
  selectedDirs: Set<number>;
  tideFilter: "any" | "only_tide" | "only_no_tide";
  regionFilter: SpotRegion | null;
}) {
  const active = selectedDirs.has(deg);
  const next = new Set(selectedDirs);
  if (active) next.delete(deg);
  else next.add(deg);
  const href = buildHref(next, tideFilter, regionFilter);
  return <Chip label={label} active={active} href={href} />;
}

function TideChip({
  label,
  value,
  active,
  selectedDirs,
  regionFilter,
}: {
  label: string;
  value: "any" | "only_tide" | "only_no_tide";
  active: boolean;
  selectedDirs: Set<number>;
  regionFilter: SpotRegion | null;
}) {
  const href = buildHref(selectedDirs, value, regionFilter);
  return <Chip label={label} active={active} href={href} />;
}

function RegionChip({
  label,
  value,
  active,
  selectedDirs,
  tideFilter,
}: {
  label: string;
  value: SpotRegion | null;
  active: boolean;
  selectedDirs: Set<number>;
  tideFilter: "any" | "only_tide" | "only_no_tide";
}) {
  const href = buildHref(selectedDirs, tideFilter, value);
  return <Chip label={label} active={active} href={href} />;
}

function Chip({
  label,
  active,
  href,
}: {
  label: string;
  active: boolean;
  href: string;
}) {
  const cls = active
    ? "border-emerald-500 bg-emerald-50 text-emerald-800 dark:border-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
    : "border-zinc-300 bg-white text-zinc-700 hover:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-300";
  return (
    <Link
      href={href}
      className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${cls}`}
    >
      {label}
    </Link>
  );
}

function SpotRow({ item }: { item: SpotWithVerdict }) {
  const peak = peakWindMs(item.hours);
  return (
    <li className="flex items-center justify-between rounded-md border border-zinc-200 px-4 py-3 transition-colors hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:border-zinc-700 dark:hover:bg-zinc-900">
      <Link href={`/spots/${item.spot.slug}`} className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="font-medium">{item.spot.name}</span>
          {item.spot.tideSensitive ? (
            <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-950 dark:text-blue-300">
              Tide
            </span>
          ) : null}
          {item.spot.region ? (
            <span className="text-xs text-zinc-500">{regionLabel(item.spot.region)}</span>
          ) : null}
        </div>
        <div className="mt-0.5 text-xs text-zinc-500">
          {item.spot.lat.toFixed(3)}°N, {item.spot.lng.toFixed(3)}°E
          {peak !== null ? (
            <>
              {" · "}
              peak <span className="font-mono">{msToKnots(peak).toFixed(0)} kn</span>
            </>
          ) : null}
        </div>
      </Link>
      <VerdictBadge verdict={item.verdict} />
    </li>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function regionLabel(region: SpotRegion): string {
  return REGIONS.find((r) => r.value === region)?.label ?? region;
}

function parseDirs(raw: string | string[] | undefined): Set<number> {
  if (!raw) return new Set();
  const list = Array.isArray(raw) ? raw : raw.split(",");
  const set = new Set<number>();
  for (const label of list) {
    const found = DIRECTIONS.find((d) => d.label === label.trim().toUpperCase());
    if (found) set.add(found.deg);
  }
  return set;
}

function parseTide(raw: string | undefined): "any" | "only_tide" | "only_no_tide" {
  if (raw === "only_tide" || raw === "only_no_tide") return raw;
  return "any";
}

function parseRegion(raw: string | undefined): SpotRegion | null {
  if (!raw) return null;
  if (REGIONS.some((r) => r.value === raw)) return raw as SpotRegion;
  return null;
}

function buildHref(
  dirs: Set<number>,
  tide: "any" | "only_tide" | "only_no_tide",
  region: SpotRegion | null,
): string {
  const params = new URLSearchParams();
  if (dirs.size > 0) {
    const labels = Array.from(dirs)
      .map((deg) => DIRECTIONS.find((d) => d.deg === deg)?.label)
      .filter((l): l is string => !!l)
      .sort();
    params.set("dir", labels.join(","));
  }
  if (tide !== "any") params.set("tide", tide);
  if (region !== null) params.set("region", region);
  const qs = params.toString();
  return qs ? `/spots?${qs}` : "/spots";
}

function nlLocalDateKey(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Amsterdam",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}
