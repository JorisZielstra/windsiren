-- home_spots: the spots a user actually kites at — drives the personalized
-- conditions score on the home dashboard. Distinct concept from
-- favorite_spots, which is a softer "bookmarked" signal:
--   - home_spots: "the spots I would actually drive to today" → score
--     calculation, kiteable-count, friends-on-the-water filter.
--   - favorite_spots: "the spots I want quick access to" → pinning in
--     the Other Spots collapsible, notifications.
--
-- A spot can be in either, both, or neither for a given user. There is no
-- hard cap on home spots; the UI suggests 1-3.

create table public.home_spots (
    user_id    uuid not null references public.users(id) on delete cascade,
    spot_id    uuid not null references public.spots(id) on delete cascade,
    -- For ordering when displayed (drag-reorder is a future commit). New
    -- inserts default to a position past the existing max for that user.
    position   int not null default 0,
    created_at timestamptz not null default now(),
    primary key (user_id, spot_id)
);

create index home_spots_user_idx on public.home_spots (user_id);

alter table public.home_spots enable row level security;

-- Self-only management. Public visibility is intentionally not granted —
-- "where I kite" can be a privacy-sensitive signal, and the dashboard
-- only ever needs the viewer's own home spots. Relax later if profile
-- pages want to surface this.
create policy home_spots_self_all
    on public.home_spots for all
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);

comment on table public.home_spots is
    'Spots driving the personalized conditions score. Distinct from favorite_spots (bookmarks).';
