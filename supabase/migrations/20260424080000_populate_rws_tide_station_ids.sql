-- =============================================================================
-- WindSiren v0.1 — Rijkswaterstaat tide station IDs for tide-sensitive spots
--
-- Each station probed live against the RWS DDL API for 2026-04-24 and
-- confirmed to return astronomical tide extremes. Most per-spot stations
-- are outright tide-prediction stations at harbor mouths; the nearby coastal
-- beach measurement points don't have predictions of their own.
--
-- IJsselmeer / Markermeer spots stay NULL — they have no tides (freshwater
-- lake). Their tide_sensitive column is already false per the seed migration.
-- =============================================================================

-- North Sea coast
update public.spots set rws_tide_station_id = 'ijmuiden.buitenhaven' where slug in (
    'wijk-aan-zee',      -- ~2 km
    'ijmuiden',          -- ~0.2 km
    'egmond-aan-zee',    -- ~16 km N
    'bloemendaal',       -- ~6 km S
    'zandvoort'          -- ~9 km S
);

update public.spots set rws_tide_station_id = 'scheveningen' where slug = 'noordwijk';
    -- ~17 km S; closer than IJmuiden, still same tidal phase zone

-- Texel / Waddenzee — use Den Helder Marsdiep (south of Texel in the strait)
update public.spots set rws_tide_station_id = 'denhelder.marsdiep' where slug in (
    'paal-17-texel',     -- ~13 km
    'waddenzee-texel'    -- ~25 km
);
