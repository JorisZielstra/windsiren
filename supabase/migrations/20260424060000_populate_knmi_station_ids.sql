-- =============================================================================
-- WindSiren v0.1 — Populate KNMI station IDs for the 14 NL spots
--
-- KNMI station IDs are standard 5-digit codes starting with "06". These are
-- rough assignments by geography for v0.1 — precise per-spot tuning comes in
-- v0.2 when we have real user feedback about which spots feel "off".
--
-- Grouping:
--   06225 IJmuiden  — North Sea coastal (covers the Noord-Holland coast)
--   06229 Texelhors — Texel island
--   06269 Lelystad  — IJsselmeer (central lake — reasonable proxy for its spots)
-- =============================================================================

update public.spots set knmi_station_id = '06225' where slug in (
    'wijk-aan-zee',
    'ijmuiden',
    'egmond-aan-zee',
    'bloemendaal',
    'zandvoort',
    'noordwijk'
);

update public.spots set knmi_station_id = '06229' where slug in (
    'paal-17-texel',
    'waddenzee-texel'
);

update public.spots set knmi_station_id = '06269' where slug in (
    'andijk',
    'schellinkhout',
    'hoekipa-dijk',
    'workum',
    'medemblik',
    'monnickendam'
);
