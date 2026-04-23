# WindSiren v0.1 — Data Model

Draft — not yet locked. Review and push back before we commit it to code/schema.

## Principles (from architecture decisions)

1. **Normalized units internally.** SI everywhere in storage + logic (m/s, Celsius, millimeters, degrees). Convert at the UI edge only (e.g. knots on screen).
2. **One source of truth per concept.** No replicated fields across tables.
3. **Provider-agnostic.** No table has `openweathermap_*` columns. A `source` enum and a JSONB for provider-specific raw payloads is fine; everything typed/queryable is normalized.
4. **Soft-delete, never hard-delete** for anything a user could reference (spots, RSVPs). Use an `active` or `deleted_at` column.

---

## Entities

### `users`
Core account record.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid, PK | Supabase auth `auth.users.id` |
| `email` | text, unique | Mirrored from auth for convenience |
| `display_name` | text, nullable | |
| `profile_mode` | enum | `beginner` \| `intermediate` \| `expert` \| `personalized` |
| `thresholds` | jsonb | **Always populated** — presets write the same shape as personalized. See `ThresholdProfile` below. |
| `notification_lead_time_hours` | int, default 48 | How far ahead to notify |
| `quiet_hours_start`, `quiet_hours_end` | time, nullable | Local time. |
| `locale` | text, default `nl-NL` | For i18n later |
| `created_at`, `updated_at` | timestamptz | |

**Subscription state is NOT on `users`.** It lives in `subscriptions` (below), sourced from RevenueCat. This keeps the app's billing truth separate from account data — a user without a subscription row = free tier.

### `spots`
The curated spot database.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid, PK | |
| `slug` | text, unique | e.g. `wijk-aan-zee` — used in URLs |
| `name` | text | Display name |
| `country_code` | text, default `NL` | ISO 3166. v0.1: always `NL`. |
| `lat`, `lng` | numeric | |
| `safe_wind_directions` | jsonb | Array of angle ranges, e.g. `[{"from": 200, "to": 320}]`. Crossing 0°/360° handled explicitly (e.g. `{"from": 340, "to": 40}`). |
| `tide_sensitive` | bool | If true, tide state participates in the verdict |
| `hazards` | text, nullable | Freeform notes ("shallow at low tide", "kite school zone 10–16") |
| `knmi_station_id` | text, nullable | For live observations. Config, not FK — KNMI stations are an external namespace. |
| `rws_tide_station_id` | text, nullable | Rijkswaterstaat station for tide data |
| `active` | bool, default true | Soft-toggle for visibility |
| `created_at`, `updated_at` | timestamptz | |

### `favorite_spots`
Many-to-many join; enforces the free-tier paywall.

| Column | Type | Notes |
|---|---|---|
| `user_id` | uuid, FK → users | |
| `spot_id` | uuid, FK → spots | |
| `notifications_enabled` | bool, default true | Per-spot notification toggle |
| `created_at` | timestamptz | |

PK: `(user_id, spot_id)`.

**Paywall enforcement** lives in a Postgres function or RLS policy:
- Free user: can have at most 1 row in `favorite_spots`
- Paid user (checked against `subscriptions`): unlimited

### `rsvps`
"I'm going" markers. Only social primitive in v0.1.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid, PK | |
| `user_id` | uuid, FK → users | |
| `spot_id` | uuid, FK → spots | |
| `planned_date` | date | Local date, not timestamp — kiters plan by day |
| `created_at` | timestamptz | |

Unique: `(user_id, spot_id, planned_date)`.

Aggregate counts (`"3 kiters are going Saturday"`) are a materialized view or a live `SELECT COUNT(*)`. Live query is fine at v0.1 volumes.

### `forecasts` (cache)
Provider-fetched forecast data, cached per spot per forecast date.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid, PK | |
| `spot_id` | uuid, FK → spots | |
| `provider` | enum | `openweathermap`, `meteoblue`, `open_meteo`, ... |
| `forecast_for_date` | date | The day this forecast predicts |
| `fetched_at` | timestamptz | |
| `hourly` | jsonb | Array of normalized `HourlyForecast` — see type below |
| `raw_payload` | jsonb, nullable | Provider's original response, for debugging/replay |

Index: `(spot_id, forecast_for_date, fetched_at DESC)` so "latest forecast for this spot/day" is cheap.

### `observations` (cache)
Real-time station data, cached briefly.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid, PK | |
| `spot_id` | uuid, FK → spots | |
| `station_id` | text | External (e.g. KNMI) |
| `observed_at` | timestamptz | |
| `wind_speed_ms`, `gust_ms` | numeric | |
| `wind_direction_deg` | int | 0–359 |
| `air_temp_c`, `water_temp_c` | numeric, nullable | Water temp often missing |
| `precipitation_mm` | numeric, nullable | |
| `pressure_hpa` | numeric, nullable | |
| `source` | enum | `knmi`, `buienradar` |

Index: `(spot_id, observed_at DESC)` — "latest observation for this spot" is the 99% query.

### `tide_events` (cache)
High/low tide events per spot per day.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid, PK | |
| `spot_id` | uuid, FK → spots | |
| `event_at` | timestamptz | |
| `type` | enum | `high` \| `low` |
| `height_cm` | numeric | Relative to local reference (NAP for NL) |
| `source` | enum | `rijkswaterstaat`, ... |

### `subscriptions`
Mirrors RevenueCat entitlement state. One row per paying user; no row = free.

| Column | Type | Notes |
|---|---|---|
| `user_id` | uuid, PK, FK → users | |
| `revenuecat_user_id` | text | |
| `tier` | enum | `paid` (room for future tiers) |
| `status` | enum | `active`, `past_due`, `cancelled`, `expired` |
| `current_period_end` | timestamptz | |
| `platform` | enum | `ios`, `android`, `web` — which store the user bought through |
| `updated_at` | timestamptz | Updated by RevenueCat webhook |

### `notifications_sent` (audit)
For the "we already notified this user about Saturday at Wijk aan Zee, don't spam them" logic.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid, PK | |
| `user_id` | uuid, FK → users | |
| `spot_id` | uuid, FK → spots | |
| `for_date` | date | Which kite day the notification was for |
| `sent_at` | timestamptz | |
| `expo_ticket_id` | text, nullable | For delivery tracking |

Unique: `(user_id, spot_id, for_date)` — idempotency.

---

## Shared types (the normalized contracts)

These live in the shared TS package — both DB and adapters produce them.

```ts
// Stored in SI; convert to knots/°C at the UI edge.
type HourlyForecast = {
  time: string;              // ISO 8601
  windSpeedMs: number;
  gustMs: number;
  windDirectionDeg: number;  // 0–359, meteorological (direction wind comes FROM)
  airTempC: number;
  waterTempC: number | null;
  precipitationMm: number;   // in the preceding hour
  cloudCoveragePct: number;
};

type Observation = {
  observedAt: string;
  stationId: string;
  windSpeedMs: number;
  gustMs: number;
  windDirectionDeg: number;
  airTempC: number | null;
  waterTempC: number | null;
  precipitationMm: number | null;
  pressureHpa: number | null;
};

type TidePoint = {
  at: string;
  type: "high" | "low";
  heightCm: number;
};

type ThresholdProfile = {
  windMinMs: number;
  windMaxMs: number;
  gustMaxMs: number;
  directionsAllowed: "spot_default" | Array<{ from: number; to: number }>;
  airTempMinC: number;
  waterTempMinC: number | null;  // null = don't care
  precipitationMaxMmPerHr: number;
  tidePreference: "any" | "mid" | "rising" | "falling";
  daylightOnly: boolean;
};

type Verdict = {
  decision: "go" | "no_go" | "marginal";
  reasons: Array<{
    metric: string;             // e.g. "wind_speed"
    passed: boolean;
    actual: number | string;
    threshold: number | string;
  }>;
};
```

---

## Adapter interfaces (the swappable contracts)

```ts
interface ForecastSource {
  name: string;                 // e.g. "openweathermap"
  fetchHourly(lat: number, lng: number, days: number): Promise<HourlyForecast[]>;
  supportsRegion(countryCode: string): boolean;
}

interface ObservationSource {
  name: string;
  fetchLatest(stationId: string): Promise<Observation>;
  listStationsNear(lat: number, lng: number, radiusKm: number): Promise<StationInfo[]>;
}

interface TideSource {
  name: string;
  fetchDailyEvents(stationId: string, date: string): Promise<TidePoint[]>;
}
```

Per-region routing ("NL → KNMI + RWS + OpenWeatherMap") is a config object, not code:

```ts
const REGION_PROVIDERS: Record<string, RegionConfig> = {
  NL: {
    forecast: "openweathermap",
    observations: "knmi",
    tides: "rijkswaterstaat",
    waterTemp: "rijkswaterstaat",
  },
  // future: DE, FR, etc.
};
```

---

## Embedded decisions worth flagging

Three judgment calls are baked in here — speak up if any are wrong:

1. **Thresholds always-populated (not sparse).** Presets write into the same JSON shape as personalized. One code path for the decision engine, at the cost of slight duplication when a user is on a preset. Alternative: store `profile_mode` only and look up preset values at eval time. I prefer always-populated for debuggability and because switching modes preserves intent (an expert who moves to personalized sees the expert thresholds as their starting point).

2. **Subscriptions in a separate table, not a column on `users`.** Makes "user without a subscription row = free" the natural query. Matches how RevenueCat webhook updates flow. Avoids a giant enum on `users` with nullable billing fields.

3. **`safe_wind_directions` as ranges, not a free text field.** Machine-evaluatable by the decision engine. The existing prototype's `kitespots.json` stores this as an array already — we just formalize it. Ranges that cross 0°/360° are explicit (`{from: 340, to: 40}` = NW through N to NE).

One I want your input on:

4. **Should `observations` and `forecasts` be in Postgres, or in a time-series store (e.g. Supabase uses TimescaleDB extension)?** For v0.1 traffic, plain Postgres is fine and simpler. At ~20 spots × 6 hourly forecasts × 3 days × 1 fetch/hr, we're writing ~9k forecast rows/day — trivial. I'd say plain Postgres until we have a reason to change. Flagging because it's an easy-to-ignore decision that gets expensive to reverse later.

---

## Out of scope for this doc

- Indexes beyond the obvious ones (design after query patterns land)
- RLS policy details (will write in Supabase SQL when we build)
- Spot-submission schema (v1.0 feature — placeholder table maybe)
- Push token storage for Expo (add when we wire notifications)

Last updated: 2026-04-23.
