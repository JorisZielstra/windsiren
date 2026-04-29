-- =============================================================================
-- WindSiren — Populate KNMI station IDs for the 50 newly seeded NL spots
--
-- Companion to 20260429100000_seed_all_nl_spots.sql. Same live-verified
-- approach as 20260424070000_correct_knmi_station_ids.sql:
--
--   1. Listed the full KNMI EDR /collections/.../locations catalog.
--   2. For each station, probed the last 60 min for ff (wind speed) and dd
--      (wind direction); kept only those returning real numbers.
--   3. For each spot without a knmi_station_id, picked the nearest live-
--      reporting station whose ID uses the WIGOS prefix 0-20000-0- (the
--      only prefix the KnmiObservationSource currently auto-prefixes).
--
-- Catalog snapshot used: tools/knmi-stations.json (probed 2026-04-29).
-- Stations 06206 (F16-A), 06210 (Valkenburg), 06212 (Hoorn-A), 06257 (Wijk
-- aan Zee), 06265 (Soesterberg), 06311 (Hoofdplaat), and 06391 (Arcen) were
-- catalogued but returned 404 on the locations endpoint at probe time and
-- are not used here.
--
-- Stored as the 5-digit WMO suffix (KnmiObservationSource prefixes with
-- "0-20000-0-" automatically). Distance column is km from spot to chosen
-- station.
--
-- Follow-up (separate migration): 9 reporting stations under the
-- 0-528-0- (Dutch CMA) prefix would shorten several distances — Muiden
-- (06236) is ~3 km from Muiderberg vs Schiphol's 22 km, Nieuw-Vennep
-- (06237) is closer to Langevelderslag than Voorschoten, Hollandse Kust
-- Noord (06213) is closer to bergen-aan-zee/schoorl-camperduin. Requires
-- KnmiObservationSource to handle the 0-528-0- prefix in addition to
-- 0-20000-0- (currently the only prefix it auto-applies).
-- =============================================================================


-- North Sea coast — North Holland
update public.spots set knmi_station_id = '06225' where slug = 'wijk-aan-zee-noordpier';            -- IJmuiden, 1.1 km
update public.spots set knmi_station_id = '06225' where slug = 'ijmuiderslag';                       -- IJmuiden, 1.9 km
update public.spots set knmi_station_id = '06225' where slug = 'castricum';                          -- IJmuiden, 11.0 km
update public.spots set knmi_station_id = '06225' where slug = 'bergen-aan-zee';                     -- IJmuiden, 22.9 km
update public.spots set knmi_station_id = '06235' where slug = 'callantsoog';                        -- De Kooy Airport, 11.5 km
update public.spots set knmi_station_id = '06235' where slug = 'schoorl-camperduin';                 -- De Kooy Airport, 24.2 km
update public.spots set knmi_station_id = '06235' where slug = 'amstelmeer';                         -- De Kooy Airport, 10.2 km
update public.spots set knmi_station_id = '06229' where slug = 'den-helder';                         -- Texelhors, 4.6 km

-- North Sea coast — South Holland
update public.spots set knmi_station_id = '06330' where slug = 'hoek-van-holland';                   -- Hoek van Holland, 0.6 km
update public.spots set knmi_station_id = '06330' where slug = 'zandmotor';                          -- Hoek van Holland, 9.0 km
update public.spots set knmi_station_id = '06330' where slug = 'oostvoorne';                         -- Hoek van Holland, 9.4 km
update public.spots set knmi_station_id = '06330' where slug = 'de-maasvlakte';                      -- Hoek van Holland, 10.5 km
update public.spots set knmi_station_id = '06330' where slug = 'de-slufter';                         -- Hoek van Holland, 11.8 km
update public.spots set knmi_station_id = '06330' where slug = 'rockanje';                           -- Hoek van Holland, 13.9 km
update public.spots set knmi_station_id = '06215' where slug = 'wassenaarse-slag';                   -- Voorschoten, 6.4 km
update public.spots set knmi_station_id = '06215' where slug = 'katwijk-aan-zee';                    -- Voorschoten, 7.2 km
update public.spots set knmi_station_id = '06215' where slug = 'scheveningen-noorderstrand';         -- Voorschoten, 12.3 km
update public.spots set knmi_station_id = '06215' where slug = 'scheveningen-zuiderstrand';          -- Voorschoten, 13.4 km
update public.spots set knmi_station_id = '06215' where slug = 'langevelderslag';                    -- Voorschoten, 18.0 km

-- Zeeland — North Sea + delta
update public.spots set knmi_station_id = '06320' where slug = 'ouddorp';                            -- Lichteiland Goeree, 18.5 km
update public.spots set knmi_station_id = '06312' where slug = 'brouwersdam';                        -- Oosterschelde, 15.9 km
update public.spots set knmi_station_id = '06324' where slug = 'ouwerkerk';                          -- Stavenisse, 4.4 km
update public.spots set knmi_station_id = '06324' where slug = 'grevelingendam';                     -- Stavenisse, 13.0 km
update public.spots set knmi_station_id = '06316' where slug = 'neeltje-jans';                       -- Schaar, 3.5 km
update public.spots set knmi_station_id = '06316' where slug = 'roompot';                            -- Schaar, 6.9 km
update public.spots set knmi_station_id = '06316' where slug = 'vrouwenpolder';                      -- Schaar, 8.4 km
update public.spots set knmi_station_id = '06310' where slug = 'borssele';                           -- Vlissingen, 8.0 km
update public.spots set knmi_station_id = '06310' where slug = 'domburg';                            -- Vlissingen, 15.3 km
update public.spots set knmi_station_id = '06315' where slug = 'baarland';                           -- Hansweert, 9.2 km
update public.spots set knmi_station_id = '06308' where slug = 'cadzand';                            -- Cadzand, 1.0 km

-- IJsselmeer / Markermeer / Friese Meren / inland lakes
update public.spots set knmi_station_id = '06267' where slug = 'hindeloopen';                        -- Stavoren, 4.3 km
update public.spots set knmi_station_id = '06267' where slug = 'mirns';                              -- Stavoren, 8.3 km
update public.spots set knmi_station_id = '06267' where slug = 'makkum';                             -- Stavoren, 17.5 km
update public.spots set knmi_station_id = '06267' where slug = 'kornwerderzand';                     -- Stavoren, 19.9 km
update public.spots set knmi_station_id = '06258' where slug = 'enkhuizen';                          -- Houtribdijk, 10.4 km
update public.spots set knmi_station_id = '06249' where slug = 'edam';                               -- Berkhout, 12.5 km
update public.spots set knmi_station_id = '06240' where slug = 'ijburg';                             -- Schiphol Airport, 16.0 km
update public.spots set knmi_station_id = '06240' where slug = 'muiderberg';                         -- Schiphol Airport, 22.1 km
update public.spots set knmi_station_id = '06273' where slug = 'lemmer';                             -- Marknesse, 20.2 km
update public.spots set knmi_station_id = '06269' where slug = 'horst';                              -- Lelystad Airport, 14.6 km

-- Wadden — islands + Waddenzee
update public.spots set knmi_station_id = '06229' where slug = 'texel-paal-9';                       -- Texelhors, 3.0 km
update public.spots set knmi_station_id = '06242' where slug = 'vlieland';                           -- Vlieland Vliehors, 11.2 km
update public.spots set knmi_station_id = '06251' where slug = 'terschelling-groene-strand';        -- Hoorn Terschelling, 9.8 km
update public.spots set knmi_station_id = '06251' where slug = 'ameland-hollum';                     -- Hoorn Terschelling, 20.2 km
update public.spots set knmi_station_id = '06208' where slug = 'ameland-noordzee-buren';             -- AWG-1, 5.9 km
update public.spots set knmi_station_id = '06208' where slug = 'ameland-waddenzee';                  -- AWG-1, 12.5 km
update public.spots set knmi_station_id = '06208' where slug = 'ameland-noordzee';                   -- AWG-1, 15.6 km
update public.spots set knmi_station_id = '06277' where slug = 'lauwersoog';                         -- Lauwersoog, 3.6 km
update public.spots set knmi_station_id = '06277' where slug = 'schiermonnikoog-noordzeekant-paal-3'; -- Lauwersoog, 9.7 km
update public.spots set knmi_station_id = '06270' where slug = 'harlingen';                          -- Leeuwarden Airport, 23.2 km
