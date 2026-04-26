-- Marks whether a user has completed the welcome flow. Null = needs
-- onboarding; non-null = either completed or skipped (we don't
-- distinguish — both should bypass the welcome page).
--
-- Backfill every existing user with now() so this migration doesn't
-- send seasoned accounts back through onboarding.

alter table public.users
    add column if not exists onboarded_at timestamptz;

update public.users
set onboarded_at = now()
where onboarded_at is null;

comment on column public.users.onboarded_at is
    'When the user finished or skipped the welcome flow. Null routes them to /welcome on next sign-in.';
