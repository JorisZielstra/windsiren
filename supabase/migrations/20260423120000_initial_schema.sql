-- =============================================================================
-- WindSiren v0.1 — Initial schema
--
-- Matches docs/data-model.md. Creates all tables, enums, RLS policies,
-- and enforcement triggers for the MVP. Idempotent on a clean database only.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1. Extensions
-- -----------------------------------------------------------------------------

create extension if not exists "pgcrypto";  -- for gen_random_uuid()


-- -----------------------------------------------------------------------------
-- 2. Enums
-- -----------------------------------------------------------------------------

create type public.profile_mode          as enum ('beginner', 'intermediate', 'expert', 'personalized');
create type public.forecast_provider     as enum ('openweathermap', 'meteoblue', 'open_meteo');
create type public.observation_source    as enum ('knmi', 'buienradar');
create type public.tide_source           as enum ('rijkswaterstaat');
create type public.tide_event_type       as enum ('high', 'low');
create type public.subscription_status   as enum ('active', 'past_due', 'cancelled', 'expired');
create type public.subscription_platform as enum ('ios', 'android', 'web');


-- -----------------------------------------------------------------------------
-- 3. users — profile data for authenticated accounts
--
-- Mirrors auth.users(id) 1:1. A trigger creates a row here on signup.
-- -----------------------------------------------------------------------------

create table public.users (
    id                           uuid primary key references auth.users(id) on delete cascade,
    email                        text not null unique,
    display_name                 text,
    profile_mode                 public.profile_mode not null default 'intermediate',
    thresholds                   jsonb not null default '{}'::jsonb,
    notification_lead_time_hours int not null default 48,
    quiet_hours_start            time,
    quiet_hours_end              time,
    locale                       text not null default 'nl-NL',
    created_at                   timestamptz not null default now(),
    updated_at                   timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
    insert into public.users (id, email)
    values (new.id, new.email);
    return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();


-- -----------------------------------------------------------------------------
-- 4. spots — curated kitesurf spot database
-- -----------------------------------------------------------------------------

create table public.spots (
    id                    uuid primary key default gen_random_uuid(),
    slug                  text not null unique,
    name                  text not null,
    country_code          text not null default 'NL',
    lat                   numeric(9, 6) not null,
    lng                   numeric(9, 6) not null,
    safe_wind_directions  jsonb not null,          -- [{"from":200,"to":320}, ...]
    tide_sensitive        boolean not null default false,
    hazards               text,
    knmi_station_id       text,
    rws_tide_station_id   text,
    active                boolean not null default true,
    created_at            timestamptz not null default now(),
    updated_at            timestamptz not null default now()
);

create index spots_country_active_idx
    on public.spots (country_code)
    where active;


-- -----------------------------------------------------------------------------
-- 5. favorite_spots — user's favorited spots (paywall enforcement below)
-- -----------------------------------------------------------------------------

create table public.favorite_spots (
    user_id               uuid not null references public.users(id) on delete cascade,
    spot_id               uuid not null references public.spots(id) on delete cascade,
    notifications_enabled boolean not null default true,
    created_at            timestamptz not null default now(),
    primary key (user_id, spot_id)
);


-- -----------------------------------------------------------------------------
-- 6. rsvps — "I'm going" markers (the only v0.1 social primitive)
-- -----------------------------------------------------------------------------

create table public.rsvps (
    id           uuid primary key default gen_random_uuid(),
    user_id      uuid not null references public.users(id) on delete cascade,
    spot_id      uuid not null references public.spots(id) on delete cascade,
    planned_date date not null,
    created_at   timestamptz not null default now(),
    unique (user_id, spot_id, planned_date)
);

create index rsvps_spot_date_idx on public.rsvps (spot_id, planned_date);


-- -----------------------------------------------------------------------------
-- 7. forecasts — provider-fetched forecast cache
-- -----------------------------------------------------------------------------

create table public.forecasts (
    id                uuid primary key default gen_random_uuid(),
    spot_id           uuid not null references public.spots(id) on delete cascade,
    provider          public.forecast_provider not null,
    forecast_for_date date not null,
    fetched_at        timestamptz not null default now(),
    hourly            jsonb not null,
    raw_payload       jsonb
);

create index forecasts_lookup_idx
    on public.forecasts (spot_id, forecast_for_date, fetched_at desc);


-- -----------------------------------------------------------------------------
-- 8. observations — real-time station cache
-- -----------------------------------------------------------------------------

create table public.observations (
    id                 uuid primary key default gen_random_uuid(),
    spot_id            uuid not null references public.spots(id) on delete cascade,
    station_id         text not null,
    observed_at        timestamptz not null,
    wind_speed_ms      numeric,
    gust_ms            numeric,
    wind_direction_deg int,
    air_temp_c         numeric,
    water_temp_c       numeric,
    precipitation_mm   numeric,
    pressure_hpa       numeric,
    source             public.observation_source not null
);

create index observations_lookup_idx
    on public.observations (spot_id, observed_at desc);


-- -----------------------------------------------------------------------------
-- 9. tide_events — tide cache
-- -----------------------------------------------------------------------------

create table public.tide_events (
    id         uuid primary key default gen_random_uuid(),
    spot_id    uuid not null references public.spots(id) on delete cascade,
    event_at   timestamptz not null,
    type       public.tide_event_type not null,
    height_cm  numeric not null,
    source     public.tide_source not null
);

create index tide_events_spot_time_idx on public.tide_events (spot_id, event_at);


-- -----------------------------------------------------------------------------
-- 10. subscriptions — paid-tier state (mirrored from RevenueCat webhook)
-- -----------------------------------------------------------------------------

create table public.subscriptions (
    user_id             uuid primary key references public.users(id) on delete cascade,
    revenuecat_user_id  text not null,
    status              public.subscription_status not null,
    current_period_end  timestamptz,
    platform            public.subscription_platform not null,
    updated_at          timestamptz not null default now()
);


-- -----------------------------------------------------------------------------
-- 11. notifications_sent — push idempotency audit
-- -----------------------------------------------------------------------------

create table public.notifications_sent (
    id              uuid primary key default gen_random_uuid(),
    user_id         uuid not null references public.users(id) on delete cascade,
    spot_id         uuid not null references public.spots(id) on delete cascade,
    for_date        date not null,
    sent_at         timestamptz not null default now(),
    expo_ticket_id  text,
    unique (user_id, spot_id, for_date)
);


-- =============================================================================
-- Row Level Security (RLS)
--
-- Default-deny on every table. Explicit policies for each access pattern.
-- Server-side code (using sb_secret_* key) bypasses RLS automatically.
-- =============================================================================

alter table public.users              enable row level security;
alter table public.spots              enable row level security;
alter table public.favorite_spots     enable row level security;
alter table public.rsvps              enable row level security;
alter table public.forecasts          enable row level security;
alter table public.observations       enable row level security;
alter table public.tide_events        enable row level security;
alter table public.subscriptions      enable row level security;
alter table public.notifications_sent enable row level security;

-- users: user reads + updates only own row
create policy users_self_read
    on public.users for select using (auth.uid() = id);

create policy users_self_update
    on public.users for update
    using (auth.uid() = id)
    with check (auth.uid() = id);

-- spots: public read for active spots; writes via service_role only (admin page)
create policy spots_public_read
    on public.spots for select using (active);

-- favorite_spots: user manages only their own
create policy favorites_self_all
    on public.favorite_spots for all
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);

-- rsvps: user manages their own. Aggregate counts for other users will be
-- exposed via a SECURITY DEFINER view in a future migration (privacy:
-- don't expose raw user_id of other users to clients).
create policy rsvps_self_all
    on public.rsvps for all
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);

-- forecasts / observations / tide_events: public read (no user data, cached)
create policy forecasts_public_read
    on public.forecasts for select using (true);

create policy observations_public_read
    on public.observations for select using (true);

create policy tide_events_public_read
    on public.tide_events for select using (true);

-- subscriptions: user reads their own; writes only via service_role (webhook)
create policy subscriptions_self_read
    on public.subscriptions for select using (auth.uid() = user_id);

-- notifications_sent: user reads their own; writes only via service_role
create policy notifications_self_read
    on public.notifications_sent for select using (auth.uid() = user_id);


-- =============================================================================
-- Paywall enforcement
--
-- Free users are limited to 1 favorite spot. Paid users (active subscription)
-- have no limit. Enforced at the database layer so neither a client bug nor
-- a missing UI check can bypass it.
-- =============================================================================

create or replace function public.enforce_favorite_spot_limit()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
    is_paid       boolean;
    current_count int;
begin
    -- Is the user currently on an active paid subscription?
    select (sub.status = 'active'
            and (sub.current_period_end is null or sub.current_period_end > now()))
    into is_paid
    from public.subscriptions sub
    where sub.user_id = new.user_id;

    is_paid := coalesce(is_paid, false);

    if is_paid then
        return new;
    end if;

    select count(*) into current_count
    from public.favorite_spots
    where user_id = new.user_id;

    if current_count >= 1 then
        raise exception 'FREE_TIER_LIMIT: Free tier is limited to 1 favorite spot. Upgrade to add more.'
            using errcode = 'P0001';
    end if;

    return new;
end;
$$;

create trigger enforce_favorite_limit_trigger
before insert on public.favorite_spots
for each row execute function public.enforce_favorite_spot_limit();


-- =============================================================================
-- updated_at auto-maintenance
-- =============================================================================

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
    new.updated_at := now();
    return new;
end;
$$;

create trigger users_set_updated_at
    before update on public.users
    for each row execute function public.set_updated_at();

create trigger spots_set_updated_at
    before update on public.spots
    for each row execute function public.set_updated_at();

create trigger subscriptions_set_updated_at
    before update on public.subscriptions
    for each row execute function public.set_updated_at();
