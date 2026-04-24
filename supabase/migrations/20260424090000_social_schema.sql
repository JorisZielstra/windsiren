-- =============================================================================
-- WindSiren v0.5 — Social schema (text-MVP)
--
-- Adds the tables + RLS needed for the follows-sessions-feeds loop:
--   - follows       : asymmetric follow graph
--   - sessions      : text-only "I rode today" posts
--   - users extras  : avatar_url, bio (nullable)
--
-- Also relaxes RLS on public profiles + rsvps so feeds can actually read
-- other users' activity. Mutations stay strictly self-only.
--
-- Photos, likes, comments, GPS tracks — deferred to later migrations.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1. users: add avatar_url + bio
-- -----------------------------------------------------------------------------

alter table public.users
    add column if not exists avatar_url text,
    add column if not exists bio        text;


-- -----------------------------------------------------------------------------
-- 2. follows — asymmetric follow graph
-- -----------------------------------------------------------------------------

create table public.follows (
    follower_id uuid not null references public.users(id) on delete cascade,
    followee_id uuid not null references public.users(id) on delete cascade,
    created_at  timestamptz not null default now(),
    primary key (follower_id, followee_id),
    check (follower_id <> followee_id)
);

-- "who follows me" + feed lookups start from followee_id
create index follows_followee_idx on public.follows (followee_id);


-- -----------------------------------------------------------------------------
-- 3. sessions — text-only posts ("I kited at X for Y minutes")
-- -----------------------------------------------------------------------------

create table public.sessions (
    id               uuid primary key default gen_random_uuid(),
    user_id          uuid not null references public.users(id) on delete cascade,
    spot_id          uuid not null references public.spots(id) on delete cascade,
    session_date     date not null,
    duration_minutes int  not null check (duration_minutes > 0 and duration_minutes < 1440),
    notes            text,
    created_at       timestamptz not null default now(),
    updated_at       timestamptz not null default now()
);

create index sessions_user_created_idx on public.sessions (user_id, created_at desc);
create index sessions_spot_created_idx on public.sessions (spot_id, created_at desc);

create trigger sessions_set_updated_at
    before update on public.sessions
    for each row execute function public.set_updated_at();


-- =============================================================================
-- Row Level Security
-- =============================================================================


-- -----------------------------------------------------------------------------
-- users: relax SELECT so any authenticated user can read any profile row.
-- Apps must NOT select email unless fetching the current user's own row.
-- -----------------------------------------------------------------------------

drop policy if exists users_self_read on public.users;
create policy users_auth_read
    on public.users for select
    to authenticated
    using (true);

-- users_self_update stays as-is (only the owner can update).


-- -----------------------------------------------------------------------------
-- rsvps: was self-only all-access. Now public-read, self-only write.
-- -----------------------------------------------------------------------------

drop policy if exists rsvps_self_all on public.rsvps;

create policy rsvps_public_read
    on public.rsvps for select using (true);

create policy rsvps_self_insert
    on public.rsvps for insert
    with check (auth.uid() = user_id);

create policy rsvps_self_update
    on public.rsvps for update
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);

create policy rsvps_self_delete
    on public.rsvps for delete
    using (auth.uid() = user_id);


-- -----------------------------------------------------------------------------
-- follows
-- -----------------------------------------------------------------------------

alter table public.follows enable row level security;

create policy follows_public_read
    on public.follows for select using (true);

create policy follows_self_insert
    on public.follows for insert
    with check (auth.uid() = follower_id);

create policy follows_self_delete
    on public.follows for delete
    using (auth.uid() = follower_id);


-- -----------------------------------------------------------------------------
-- sessions
-- -----------------------------------------------------------------------------

alter table public.sessions enable row level security;

create policy sessions_public_read
    on public.sessions for select using (true);

create policy sessions_self_insert
    on public.sessions for insert
    with check (auth.uid() = user_id);

create policy sessions_self_update
    on public.sessions for update
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);

create policy sessions_self_delete
    on public.sessions for delete
    using (auth.uid() = user_id);
