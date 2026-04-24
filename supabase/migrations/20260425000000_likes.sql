-- =============================================================================
-- WindSiren — Likes on sessions
--
-- Simple "I like this session" toggle. Public read so counts/avatars can
-- be shown anywhere; self-only insert/delete so users only manage their own.
-- =============================================================================

create table public.likes (
    user_id    uuid not null references public.users(id) on delete cascade,
    session_id uuid not null references public.sessions(id) on delete cascade,
    created_at timestamptz not null default now(),
    primary key (user_id, session_id)
);

create index likes_session_idx on public.likes (session_id);

alter table public.likes enable row level security;

create policy likes_public_read
    on public.likes for select using (true);

create policy likes_self_insert
    on public.likes for insert
    with check (auth.uid() = user_id);

create policy likes_self_delete
    on public.likes for delete
    using (auth.uid() = user_id);
