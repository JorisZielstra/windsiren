-- =============================================================================
-- WindSiren — Wind context columns on sessions
--
-- Stores the conditions that were on the water DURING a session, so the
-- session card can lead with wind context instead of just duration + notes.
-- All columns nullable: pre-existing sessions and backdated sessions where
-- we couldn't fetch a forecast keep null and the UI hides the chip.
-- =============================================================================

alter table public.sessions
    add column if not exists wind_avg_ms      numeric,
    add column if not exists wind_max_ms      numeric,
    add column if not exists wind_dir_avg_deg int,
    add column if not exists gust_max_ms      numeric;
