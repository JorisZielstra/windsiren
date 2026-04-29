-- Live-tracked session telemetry. One row per logged session that was
-- recorded with the phone (manual logs continue to live only in
-- `sessions`). Polyline + jumps are denormalized as jsonb so we can
-- write a whole track in one upsert and read it back without joins —
-- a session lasts ~1–3h with at most a few hundred GPS points and
-- dozens of jumps, well within jsonb sweet spot.
create table public.session_tracks (
  id              uuid primary key default gen_random_uuid(),
  session_id      uuid not null unique references public.sessions(id) on delete cascade,
  user_id         uuid not null references public.users(id) on delete cascade,
  top_speed_ms    numeric(5, 2) not null default 0,
  distance_m      numeric(10, 2) not null default 0,
  jump_count      smallint not null default 0,
  max_jump_m      numeric(4, 2) not null default 0,
  -- Array of { t: ISO timestamp, lat: number, lng: number, speed: m/s }.
  -- Down-sampled to ~1 sample / 2s to keep payload reasonable.
  polyline        jsonb not null default '[]'::jsonb,
  -- Array of { t: ISO timestamp, height_m: number, airtime_s: number }.
  jumps           jsonb not null default '[]'::jsonb,
  created_at      timestamptz not null default now()
);

create index session_tracks_user_idx on public.session_tracks (user_id, created_at desc);

alter table public.session_tracks enable row level security;

-- Public read so the feed + spot pages can show a track. Self-only
-- write — same convention as sessions.
create policy session_tracks_public_read
  on public.session_tracks for select using (true);

create policy session_tracks_self_insert
  on public.session_tracks for insert
  with check (auth.uid() = user_id);

create policy session_tracks_self_update
  on public.session_tracks for update
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy session_tracks_self_delete
  on public.session_tracks for delete
  using (auth.uid() = user_id);
