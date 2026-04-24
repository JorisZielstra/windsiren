-- =============================================================================
-- WindSiren v0.1 — KNMI station IDs, verified against live KNMI EDR API
--
-- Each station probed live before committing. Stations 06257 (Wijk aan Zee)
-- and 06210 (Valkenburg) are listed in the KNMI catalog but weren't returning
-- 10-min wind data at the time of assignment — those spots fall back to the
-- nearest station that IS reporting (06225 IJmuiden).
--
-- Stored as the 5-digit WMO suffix; KnmiObservationSource prefixes with
-- "0-20000-0-" (WIGOS identifier) when hitting the API.
--
-- Distance column is km from spot to chosen station.
-- =============================================================================

-- North Sea coast (all mapped to IJmuiden — Wijk aan Zee station 06257
-- catalogued but not actively reporting 10-min wind)
update public.spots set knmi_station_id = '06225' where slug = 'wijk-aan-zee';      -- IJmuiden, 6 km
update public.spots set knmi_station_id = '06225' where slug = 'ijmuiden';          -- IJmuiden, 0.7 km
update public.spots set knmi_station_id = '06225' where slug = 'egmond-aan-zee';    -- IJmuiden, 17 km
update public.spots set knmi_station_id = '06225' where slug = 'bloemendaal';       -- IJmuiden, 6 km
update public.spots set knmi_station_id = '06225' where slug = 'zandvoort';         -- IJmuiden, 9 km
update public.spots set knmi_station_id = '06225' where slug = 'noordwijk';         -- IJmuiden, 25 km (Valkenburg 06210 not reporting)

-- Texel
update public.spots set knmi_station_id = '06229' where slug = 'paal-17-texel';     -- Texelhors, 10 km
update public.spots set knmi_station_id = '06229' where slug = 'waddenzee-texel';   -- Texelhors, 22 km (same island)

-- IJsselmeer / Markermeer
update public.spots set knmi_station_id = '06248' where slug = 'schellinkhout';     -- Wijdenes, 3.6 km
update public.spots set knmi_station_id = '06248' where slug = 'andijk';            -- Wijdenes, 12 km
update public.spots set knmi_station_id = '06248' where slug = 'medemblik';         -- Wijdenes, 14 km
update public.spots set knmi_station_id = '06258' where slug = 'hoekipa-dijk';      -- Houtribdijk, 14 km (same dam)
update public.spots set knmi_station_id = '06267' where slug = 'workum';            -- Stavoren, 8 km
update public.spots set knmi_station_id = '06249' where slug = 'monnickendam';      -- Berkhout, 21 km
