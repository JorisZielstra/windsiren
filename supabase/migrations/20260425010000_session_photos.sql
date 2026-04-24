-- =============================================================================
-- WindSiren — Photos on sessions (schema + Storage bucket + RLS)
--
-- Up to 4 photos per session, stored in the session-photos bucket at
--   <user_id>/<session_id>/<uuid>.<ext>
-- The first path segment is the owner's user_id, which the storage RLS uses
-- to authorize delete on objects.
--
-- Public-read bucket — photos are visible to anyone with the URL. Posters
-- can delete their own. v0.1 has no pre-upload moderation; report flow +
-- super-user review queue come later. CSAM scanning before App Store launch.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1. Storage bucket (idempotent)
-- -----------------------------------------------------------------------------

insert into storage.buckets (id, name, public)
values ('session-photos', 'session-photos', true)
on conflict (id) do nothing;


-- -----------------------------------------------------------------------------
-- 2. Storage RLS — operates on storage.objects
-- -----------------------------------------------------------------------------

-- Public can read any object in the session-photos bucket.
drop policy if exists session_photos_public_read on storage.objects;
create policy session_photos_public_read
    on storage.objects for select
    using (bucket_id = 'session-photos');

-- Authenticated users may upload to a path whose first folder segment is
-- their own user_id (so they can only put files under their own folder).
drop policy if exists session_photos_owner_insert on storage.objects;
create policy session_photos_owner_insert
    on storage.objects for insert
    to authenticated
    with check (
        bucket_id = 'session-photos'
        and (storage.foldername(name))[1] = auth.uid()::text
    );

-- Owners may delete their own files.
drop policy if exists session_photos_owner_delete on storage.objects;
create policy session_photos_owner_delete
    on storage.objects for delete
    to authenticated
    using (
        bucket_id = 'session-photos'
        and (storage.foldername(name))[1] = auth.uid()::text
    );


-- -----------------------------------------------------------------------------
-- 3. session_photos table — links Storage objects to sessions
-- -----------------------------------------------------------------------------

create table public.session_photos (
    id           uuid primary key default gen_random_uuid(),
    session_id   uuid not null references public.sessions(id) on delete cascade,
    storage_path text not null unique,
    ordinal      int  not null check (ordinal >= 0 and ordinal < 4),
    created_at   timestamptz not null default now()
);

create index session_photos_session_idx on public.session_photos (session_id, ordinal);

alter table public.session_photos enable row level security;

-- Public read mirrors sessions + bucket: anyone can see a session, anyone
-- can see what photos belong to it.
create policy session_photos_public_read
    on public.session_photos for select using (true);

-- Only the session's owner can attach a photo row.
create policy session_photos_owner_insert
    on public.session_photos for insert
    with check (
        auth.uid() = (select user_id from public.sessions where id = session_id)
    );

create policy session_photos_owner_delete
    on public.session_photos for delete
    using (
        auth.uid() = (select user_id from public.sessions where id = session_id)
    );
