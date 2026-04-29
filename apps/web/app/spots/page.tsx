import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import {
  dbRowToSpot,
  fetchSpotWeek,
  getUserPrefs,
  peakWindMs,
  prefsToThresholds,
  type SpotWithVerdict,
} from "@windsiren/core";
import {
  directionInAnyRange,
  msToKnots,
  type SpotRegion,
} from "@windsiren/shared";
import { NearestSpotList, type NearestItem } from "@/components/NearestSpotList";
import { VerdictBadge } from "@/components/VerdictBadge";

export const dynamic = "force-dynamic";

type SortKey = "verdict" | "wind" | "name" | "nearest";

const SORTS: { value: SortKey; label: string }[] = [
  { value: "verdict", label: "Best today" },
  { value: "wind", label: "Strongest wind" },
  { value: "name", label: "A → Z" },
  { value: "nearest", label: "Nearest to me" },
];

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
  sort?: string;
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
  const sortKey = parseSort(params.sort);

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
  const authed = await createSupabaseServerClient();
  const {
    data: { user },
  } = await authed.auth.getUser();
  const userPrefs = await getUserPrefs(authed, user?.id ?? null);
  const userThresholds = prefsToThresholds(userPrefs);
  const spotWeeks = await Promise.all(
    spots.map((s) => fetchSpotWeek(s, 1, userThresholds)),
  );
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

  // Server-side sorts. "nearest" defers to the client (geolocation), so
  // here we just stable-fall-back to "verdict" order.
  const score = (item: SpotWithVerdict): number => {
    if (item.verdict?.decision === "go") return 3;
    if (item.verdict?.decision === "marginal") return 2;
    if (item.verdict?.decision === "no_go") return 1;
    return 0;
  };
  const sorted = [...filtered].sort((a, b) => {
    if (sortKey === "name") return a.spot.name.localeCompare(b.spot.name);
    if (sortKey === "wind") {
      const peakA = peakWindMs(a.hours) ?? -1;
      const peakB = peakWindMs(b.hours) ?? -1;
      const d = peakB - peakA;
      if (d !== 0) return d;
      return a.spot.name.localeCompare(b.spot.name);
    }
    // verdict + nearest fallback
    const d = score(b) - score(a);
    if (d !== 0) return d;
    return a.spot.name.localeCompare(b.spot.name);
  });

  const filtersActive =
    selectedDirs.size > 0 || tideFilter !== "any" || regionFilter !== null;

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="headline text-5xl text-ink">Spots</h1>
      <p className="mt-2 font-mono text-xs uppercase tracking-[0.18em] text-ink-mute">
        {filtered.length} of {items.length} NL spots
        {filtersActive ? " · filtered" : ""}
      </p>

      <FiltersBar
        selectedDirs={selectedDirs}
        tideFilter={tideFilter}
        regionFilter={regionFilter}
        sortKey={sortKey}
      />

      <SortBar
        sortKey={sortKey}
        selectedDirs={selectedDirs}
        tideFilter={tideFilter}
        regionFilter={regionFilter}
      />

      {sorted.length === 0 ? (
        <div className="mt-8 rounded-xl border border-border bg-paper-2 px-4 py-8 text-center text-sm text-ink-mute">
          No spots match these filters.{" "}
          <Link href="/spots" className="underline">
            Clear filters
          </Link>
        </div>
      ) : sortKey === "nearest" ? (
        <NearestSpotList items={sorted.map(toNearestItem)} />
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

function toNearestItem(item: SpotWithVerdict): NearestItem {
  return {
    id: item.spot.id,
    slug: item.spot.slug,
    name: item.spot.name,
    lat: item.spot.lat,
    lng: item.spot.lng,
    region: item.spot.region ?? null,
    tideSensitive: item.spot.tideSensitive,
    decision: item.verdict?.decision ?? null,
    peakKn: peakWindMs(item.hours) === null
      ? null
      : msToKnots(peakWindMs(item.hours) as number),
  };
}

function FiltersBar({
  selectedDirs,
  tideFilter,
  regionFilter,
  sortKey,
}: {
  selectedDirs: Set<number>;
  tideFilter: "any" | "only_tide" | "only_no_tide";
  regionFilter: SpotRegion | null;
  sortKey: SortKey;
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
            sortKey={sortKey}
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
          sortKey={sortKey}
        />
        <TideChip
          label="Tide-sensitive"
          value="only_tide"
          active={tideFilter === "only_tide"}
          selectedDirs={selectedDirs}
          regionFilter={regionFilter}
          sortKey={sortKey}
        />
        <TideChip
          label="Inland / no tide"
          value="only_no_tide"
          active={tideFilter === "only_no_tide"}
          selectedDirs={selectedDirs}
          regionFilter={regionFilter}
          sortKey={sortKey}
        />
      </FilterGroup>
      <FilterGroup label="Region">
        <RegionChip
          label="All"
          value={null}
          active={regionFilter === null}
          selectedDirs={selectedDirs}
          tideFilter={tideFilter}
          sortKey={sortKey}
        />
        {REGIONS.map((r) => (
          <RegionChip
            key={r.value}
            label={r.label}
            value={r.value}
            active={regionFilter === r.value}
            selectedDirs={selectedDirs}
            tideFilter={tideFilter}
            sortKey={sortKey}
          />
        ))}
      </FilterGroup>
    </div>
  );
}

function SortBar({
  sortKey,
  selectedDirs,
  tideFilter,
  regionFilter,
}: {
  sortKey: SortKey;
  selectedDirs: Set<number>;
  tideFilter: "any" | "only_tide" | "only_no_tide";
  regionFilter: SpotRegion | null;
}) {
  return (
    <div className="mt-3">
      <FilterGroup label="Sort by">
        {SORTS.map((s) => (
          <Chip
            key={s.value}
            label={s.label}
            active={s.value === sortKey}
            href={buildHref(selectedDirs, tideFilter, regionFilter, s.value)}
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
      <p className="mb-2 font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-ink-mute">
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
  sortKey,
}: {
  label: string;
  deg: number;
  selectedDirs: Set<number>;
  tideFilter: "any" | "only_tide" | "only_no_tide";
  regionFilter: SpotRegion | null;
  sortKey: SortKey;
}) {
  const active = selectedDirs.has(deg);
  const next = new Set(selectedDirs);
  if (active) next.delete(deg);
  else next.add(deg);
  const href = buildHref(next, tideFilter, regionFilter, sortKey);
  return <Chip label={label} active={active} href={href} />;
}

function TideChip({
  label,
  value,
  active,
  selectedDirs,
  regionFilter,
  sortKey,
}: {
  label: string;
  value: "any" | "only_tide" | "only_no_tide";
  active: boolean;
  selectedDirs: Set<number>;
  regionFilter: SpotRegion | null;
  sortKey: SortKey;
}) {
  const href = buildHref(selectedDirs, value, regionFilter, sortKey);
  return <Chip label={label} active={active} href={href} />;
}

function RegionChip({
  label,
  value,
  active,
  selectedDirs,
  tideFilter,
  sortKey,
}: {
  label: string;
  value: SpotRegion | null;
  active: boolean;
  selectedDirs: Set<number>;
  tideFilter: "any" | "only_tide" | "only_no_tide";
  sortKey: SortKey;
}) {
  const href = buildHref(selectedDirs, tideFilter, value, sortKey);
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
    ? "border-brand bg-brand-soft text-brand-strong"
    : "border-border bg-paper-2 text-ink-2 hover:border-border-strong hover:text-ink";
  return (
    <Link
      href={href}
      className={`rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${cls}`}
    >
      {label}
    </Link>
  );
}

function SpotRow({ item }: { item: SpotWithVerdict }) {
  const peak = peakWindMs(item.hours);
  return (
    <li className="flex items-center justify-between rounded-lg border border-border bg-paper-2 px-4 py-3 transition-colors hover:border-border-strong hover:bg-paper-sunk">
      <Link href={`/spots/${item.spot.slug}`} className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-ink">{item.spot.name}</span>
          {item.spot.tideSensitive ? (
            <span className="rounded-full bg-brand-soft px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-brand-strong">
              Tide
            </span>
          ) : null}
          {item.spot.region ? (
            <span className="text-xs text-ink-mute">{regionLabel(item.spot.region)}</span>
          ) : null}
        </div>
        <div className="mt-0.5 text-xs text-ink-mute">
          <span className="font-mono">
            {item.spot.lat.toFixed(3)}°N, {item.spot.lng.toFixed(3)}°E
          </span>
          {peak !== null ? (
            <>
              {" · "}
              peak{" "}
              <span className="font-mono font-semibold text-ink-2">
                {msToKnots(peak).toFixed(0)} kn
              </span>
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

function parseSort(raw: string | undefined): SortKey {
  if (raw === "wind" || raw === "name" || raw === "nearest") return raw;
  return "verdict";
}

function buildHref(
  dirs: Set<number>,
  tide: "any" | "only_tide" | "only_no_tide",
  region: SpotRegion | null,
  sort: SortKey,
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
  if (sort !== "verdict") params.set("sort", sort);
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
