-- =============================================================================
-- WindSiren — Comments on sessions
--
-- Single-level threaded comments (no replies) — text only, 1..1000 chars.
-- Public read so counts + bodies render anywhere; self-only writes.
-- =============================================================================

create table public.session_comments (
    id         uuid primary key default gen_random_uuid(),
    session_id uuid not null references public.sessions(id) on delete cascade,
    user_id    uuid not null references public.users(id) on delete cascade,
    body       text not null check (length(body) > 0 and length(body) <= 1000),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index session_comments_session_idx on public.session_comments (session_id, created_at);

alter table public.session_comments enable row level security;

create policy session_comments_public_read
    on public.session_comments for select using (true);

create policy session_comments_self_insert
    on public.session_comments for insert
    with check (auth.uid() = user_id);

create policy session_comments_self_update
    on public.session_comments for update
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);

create policy session_comments_self_delete
    on public.session_comments for delete
    using (auth.uid() = user_id);

create trigger session_comments_set_updated_at
    before update on public.session_comments
    for each row execute function public.set_updated_at();
