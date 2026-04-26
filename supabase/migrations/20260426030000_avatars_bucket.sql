-- =============================================================================
-- WindSiren — Avatar uploads
--
-- A new "avatars" Storage bucket holds user profile photos. The path
-- format is <user_id>/<uuid>.<ext> — same first-segment-is-owner pattern
-- as session-photos, so the RLS policies on storage.objects enforce
-- "users can write only their own folder".
--
-- Note: there is no avatars table — the public URL is stored directly on
-- users.avatar_url (column added in 20260424090000_social_schema.sql).
-- A new upload overwrites that field, but the previous file in Storage
-- is left in place. v0.1 cardinality is fine; a sweep job can prune
-- orphans later.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Storage bucket (idempotent)
-- -----------------------------------------------------------------------------

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;


-- -----------------------------------------------------------------------------
-- 2. Storage RLS — operates on storage.objects
-- -----------------------------------------------------------------------------

-- Public can read any object in the avatars bucket.
drop policy if exists avatars_public_read on storage.objects;
create policy avatars_public_read
    on storage.objects for select
    using (bucket_id = 'avatars');

-- Authenticated users may upload to a path whose first folder segment is
-- their own user_id.
drop policy if exists avatars_owner_insert on storage.objects;
create policy avatars_owner_insert
    on storage.objects for insert
    to authenticated
    with check (
        bucket_id = 'avatars'
        and (storage.foldername(name))[1] = auth.uid()::text
    );

-- Owners may overwrite (update) their own files. Useful when a client
-- replaces the same path; for our v0.1 we always pick a new uuid, but
-- keep the policy in place for symmetry with session-photos.
drop policy if exists avatars_owner_update on storage.objects;
create policy avatars_owner_update
    on storage.objects for update
    to authenticated
    using (
        bucket_id = 'avatars'
        and (storage.foldername(name))[1] = auth.uid()::text
    );

-- Owners may delete their own files.
drop policy if exists avatars_owner_delete on storage.objects;
create policy avatars_owner_delete
    on storage.objects for delete
    to authenticated
    using (
        bucket_id = 'avatars'
        and (storage.foldername(name))[1] = auth.uid()::text
    );
