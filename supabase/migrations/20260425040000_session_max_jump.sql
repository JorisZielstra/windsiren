-- Adds an optional max-jump-height field to sessions for the
-- "biggest jump" stat on user profiles. v0.1 captures it via manual
-- entry in the session composer. Eventually we'll integrate sensor
-- providers (Woo, Surfr, etc.) to fill it in automatically.
alter table public.sessions
    add column if not exists max_jump_m numeric;

comment on column public.sessions.max_jump_m is
    'Optional self-reported max jump height in meters. Sensor integration is a future migration.';
