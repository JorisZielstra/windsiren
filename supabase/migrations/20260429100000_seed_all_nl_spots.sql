-- =============================================================================
-- WindSiren — Comprehensive NL kitesurf spots seed
--
-- Adds the full set of Dutch kite spots (64 total) to the spots table.
-- Source: WindSiren spot dataset (windsiren_kitespots_nl.json).
--
-- Only fields that exist in the current spots schema are imported:
--   slug, name, country_code, lat, lng, safe_wind_directions,
--   tide_sensitive, region, hazards, active.
-- The dataset's description/notes/confidence/needs_review fields are
-- intentionally dropped (not part of the schema).
--
-- Steps:
--   1. Rename the 5 legacy seed slugs to their canonical equivalents in
--      the new dataset, so we don't end up with duplicate spots after the
--      bulk insert. Foreign keys (favorite_spots, home_spots, rsvps,
--      sessions, …) reference spots.id, not slug — so renames are safe for
--      relational integrity. The carefully verified knmi_station_id and
--      rws_tide_station_id values stay attached to the renamed rows.
--   2. INSERT all 64 NL spots ON CONFLICT (slug) DO NOTHING — so the 14
--      already-seeded spots keep their existing curated lat/lng,
--      safe_wind_directions, tide_sensitive, region, and station IDs.
--   3. Backfill hazards on the existing 14 spots where it's currently NULL
--      and the JSON dataset provides a value, since hazards is the one
--      column with new content for many already-seeded spots.
--
-- knmi_station_id and rws_tide_station_id remain NULL for the new spots —
-- a follow-up migration will populate them once each station is verified
-- live (same pattern as 20260424070000 / 20260424080000).
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1. Rename legacy slugs to canonical (preserve all existing column data).
-- -----------------------------------------------------------------------------

update public.spots set slug = 'texel-paal-17'           where slug = 'paal-17-texel';
update public.spots set slug = 'wijk-aan-zee-de-bunker'  where slug = 'wijk-aan-zee';
update public.spots set slug = 'ijmuiden-zuidpier'       where slug = 'ijmuiden';
update public.spots set slug = 'texel-vuurtoren'         where slug = 'waddenzee-texel';
update public.spots set slug = 'lelystad'                where slug = 'hoekipa-dijk';


-- -----------------------------------------------------------------------------
-- 2. Insert all 64 NL spots. Existing slugs are skipped (preserve curated data).
-- -----------------------------------------------------------------------------

insert into public.spots
    (slug, name, country_code, lat, lng, safe_wind_directions, tide_sensitive, region, hazards, active)
values
    -- Zeeland (delta region, tidal)
    ('ouwerkerk',                          'Ouwerkerk',                          'NL', 51.617716, 3.953895, '[{"from":180,"to":270}]'::jsonb, true,  'zeeland',       'Groynes; oyster beds; shipping channel.',                  true),
    ('cadzand',                            'Cadzand',                            'NL', 51.381131, 3.393173, '[{"from":225,"to":23}]'::jsonb,  true,  'zeeland',       'Tidal currents.',                                          true),
    ('roompot',                            'Roompot',                            'NL', 51.594995, 3.716885, '[{"from":270,"to":90}]'::jsonb,  true,  'zeeland',       'Oyster beds.',                                             true),
    ('baarland',                           'Baarland',                           'NL', 51.394199, 3.894396, '[{"from":90,"to":270}]'::jsonb,  true,  'zeeland',       'Strong currents.',                                         true),
    ('borssele',                           'Borssele',                           'NL', 51.434017, 3.710928, '[{"from":180,"to":270}]'::jsonb, true,  'zeeland',       'Groynes; oyster beds; shipping channel.',                  true),
    ('vrouwenpolder',                      'Vrouwenpolder',                      'NL', 51.589292, 3.637225, '[{"from":315,"to":90}]'::jsonb,  true,  'zeeland',       'Tidal currents.',                                          true),
    ('neeltje-jans',                       'Neeltje Jans',                       'NL', 51.624939, 3.683893, '[{"from":225,"to":0}]'::jsonb,   true,  'zeeland',       'Tidal currents.',                                          true),
    ('domburg',                            'Domburg',                            'NL', 51.549956, 3.459562, '[{"from":248,"to":45}]'::jsonb,  true,  'zeeland',       'Strong currents; surfers.',                                true),
    ('grevelingendam',                     'Grevelingendam',                     'NL', 51.678948, 4.138895, '[{"from":270,"to":90}]'::jsonb,  true,  'zeeland',       null,                                                       true),

    -- South Holland (North Sea coast + delta mouths)
    ('ouddorp',                            'Ouddorp',                            'NL', 51.821462, 3.880572, '[{"from":248,"to":45}]'::jsonb,  true,  'south_holland', 'Tidal currents; surfers; sandbars; seals.',                true),
    ('scheveningen-noorderstrand',         'Scheveningen (Noorderstrand)',       'NL', 52.103539, 4.265553, '[{"from":203,"to":23}]'::jsonb,  true,  'south_holland', null,                                                       true),
    ('wassenaarse-slag',                   'Wassenaarse Slag',                   'NL', 52.163418, 4.350723, '[{"from":225,"to":23}]'::jsonb,  true,  'south_holland', null,                                                       true),
    ('scheveningen-zuiderstrand',          'Scheveningen (Zuiderstrand)',        'NL', 52.096300, 4.253775, '[{"from":203,"to":23}]'::jsonb,  true,  'south_holland', 'Drops off quickly.',                                       true),
    ('rockanje',                           'Rockanje',                           'NL', 51.876426, 4.041637, '[{"from":158,"to":315}]'::jsonb, true,  'south_holland', 'Drops off quickly; sandbars.',                             true),
    ('langevelderslag',                    'Langevelderslag',                    'NL', 52.299039, 4.479717, '[{"from":203,"to":23}]'::jsonb,  true,  'south_holland', 'Strong currents.',                                         true),
    ('oostvoorne',                         'Oostvoorne',                         'NL', 51.915884, 4.060405, '[{"from":225,"to":270}]'::jsonb, true,  'south_holland', null,                                                       true),
    ('noordwijk',                          'Noordwijk',                          'NL', 52.235905, 4.422118, '[{"from":203,"to":23}]'::jsonb,  true,  'south_holland', 'Tidal currents; surfers.',                                 true),
    ('de-slufter',                         'de Slufter',                         'NL', 51.918621, 3.995954, '[{"from":158,"to":270}]'::jsonb, true,  'south_holland', 'Advanced riders only.',                                    true),
    ('de-maasvlakte',                      'De Maasvlakte',                      'NL', 51.973297, 3.971726, '[{"from":203,"to":338}]'::jsonb, true,  'south_holland', 'Tidal currents; advanced riders only.',                    true),
    ('katwijk-aan-zee',                    'Katwijk aan Zee',                    'NL', 52.196480, 4.385678, '[{"from":225,"to":23}]'::jsonb,  true,  'south_holland', 'Tidal currents; drops off quickly.',                       true),
    ('hoek-van-holland',                   'Hoek van Holland',                   'NL', 51.993328, 4.114316, '[{"from":270,"to":45}]'::jsonb,  true,  'south_holland', null,                                                       true),
    ('zandmotor',                          'Zandmotor',                          'NL', 52.057900, 4.194985, '[{"from":225,"to":23}]'::jsonb,  true,  'south_holland', 'Tidal currents.',                                          true),
    ('brouwersdam',                        'Brouwersdam',                        'NL', 51.762086, 3.852133, '[{"from":225,"to":23}]'::jsonb,  true,  'south_holland', 'Tidal currents.',                                          true),

    -- North Holland (North Sea coast)
    ('bloemendaal',                        'Bloemendaal',                        'NL', 52.421557, 4.553734, '[{"from":225,"to":23}]'::jsonb,  true,  'north_holland', 'Strong currents.',                                         true),
    ('ijmuiderslag',                       'IJmuiderslag',                       'NL', 52.445508, 4.559073, '[{"from":180,"to":338}]'::jsonb, true,  'north_holland', 'Swimmers; surfers.',                                       true),
    ('den-helder',                         'Den Helder',                         'NL', 52.953333, 4.723660, '[{"from":225,"to":23}]'::jsonb,  true,  'north_holland', 'Strong currents; groynes; seals.',                         true),
    ('castricum',                          'Castricum',                          'NL', 52.556353, 4.606179, '[{"from":203,"to":0}]'::jsonb,   true,  'north_holland', null,                                                       true),
    ('callantsoog',                        'Callantsoog',                        'NL', 52.838628, 4.691977, '[{"from":203,"to":0}]'::jsonb,   true,  'north_holland', 'Tidal currents; drops off quickly; swimmers; groynes.',    true),
    ('bergen-aan-zee',                     'Bergen aan Zee',                     'NL', 52.662853, 4.629476, '[{"from":203,"to":338}]'::jsonb, true,  'north_holland', 'Tidal currents.',                                          true),
    ('egmond-aan-zee',                     'Egmond aan Zee',                     'NL', 52.614596, 4.618737, '[{"from":203,"to":0}]'::jsonb,   true,  'north_holland', 'Tidal currents; drops off quickly; sandbars.',             true),
    ('zandvoort',                          'Zandvoort',                          'NL', 52.383434, 4.529143, '[{"from":225,"to":23}]'::jsonb,  true,  'north_holland', 'Strong currents; sandbars.',                               true),
    ('schoorl-camperduin',                 'Schoorl-Camperduin',                 'NL', 52.726372, 4.641909, '[{"from":203,"to":0}]'::jsonb,   true,  'north_holland', 'Strong currents.',                                         true),
    ('ijmuiden-zuidpier',                  'IJmuiden Zuidpier',                  'NL', 52.456673, 4.557947, '[{"from":180,"to":338}]'::jsonb, true,  'north_holland', 'Tidal currents; swimmers; surfers.',                       true),
    ('wijk-aan-zee-noordpier',             'Wijk aan Zee Noordpier',             'NL', 52.469533, 4.565104, '[{"from":225,"to":23}]'::jsonb,  true,  'north_holland', 'Tidal currents; drops off quickly; swimmers; surfers.',    true),
    ('wijk-aan-zee-de-bunker',             'Wijk aan Zee de Bunker',             'NL', 52.482813, 4.579293, '[{"from":225,"to":23}]'::jsonb,  true,  'north_holland', 'Strong currents; drops off quickly.',                      true),

    -- IJsselmeer / Markermeer / inland lakes (freshwater, no tide)
    ('amstelmeer',                         'Amstelmeer',                         'NL', 52.885157, 4.916465, '[{"from":180,"to":338}]'::jsonb, false, 'ijsselmeer',    null,                                                       true),
    ('makkum',                             'Makkum',                             'NL', 53.054297, 5.374248, '[{"from":180,"to":0}]'::jsonb,   false, 'ijsselmeer',    'Swimmers.',                                                true),
    ('lemmer',                             'Lemmer',                             'NL', 52.843832, 5.699438, '[{"from":225,"to":270}]'::jsonb, false, 'ijsselmeer',    'Groynes.',                                                 true),
    ('lelystad',                           'Lelystad',                           'NL', 52.526856, 5.425310, '[]'::jsonb,                      false, 'ijsselmeer',    null,                                                       true),
    ('monnickendam',                       'Monnickendam',                       'NL', 52.455987, 5.050269, '[{"from":23,"to":180}]'::jsonb,  false, 'ijsselmeer',    null,                                                       true),
    ('mirns',                              'Mirns',                              'NL', 52.851642, 5.481603, '[{"from":90,"to":270}]'::jsonb,  false, 'ijsselmeer',    'Swimmers.',                                                true),
    ('medemblik',                          'Medemblik',                          'NL', 52.755436, 5.121427, '[{"from":0,"to":90}]'::jsonb,    false, 'ijsselmeer',    null,                                                       true),
    ('ijburg',                             'IJburg',                             'NL', 52.354589, 5.017272, '[{"from":45,"to":90}]'::jsonb,   false, 'ijsselmeer',    null,                                                       true),
    ('kornwerderzand',                     'Kornwerderzand',                     'NL', 53.073531, 5.339882, '[{"from":90,"to":270}]'::jsonb,  false, 'ijsselmeer',    'Drops off quickly.',                                       true),
    ('hindeloopen',                        'Hindeloopen',                        'NL', 52.933461, 5.403571, '[{"from":180,"to":0}]'::jsonb,   false, 'ijsselmeer',    null,                                                       true),
    ('enkhuizen',                          'Enkhuizen',                          'NL', 52.713333, 5.289642, '[{"from":338,"to":113}]'::jsonb, false, 'ijsselmeer',    null,                                                       true),
    ('andijk',                             'Andijk',                             'NL', 52.736762, 5.172243, '[{"from":315,"to":90}]'::jsonb,  false, 'ijsselmeer',    null,                                                       true),
    ('muiderberg',                         'Muiderberg',                         'NL', 52.329630, 5.113730, '[{"from":315,"to":45}]'::jsonb,  false, 'ijsselmeer',    'Swimmers; shipping channel.',                              true),
    ('edam',                               'Edam',                               'NL', 52.540090, 5.053007, '[{"from":23,"to":158}]'::jsonb,  false, 'ijsselmeer',    null,                                                       true),
    ('horst',                              'Horst',                              'NL', 52.322555, 5.570793, '[{"from":225,"to":45}]'::jsonb,  false, 'ijsselmeer',    'Shipping channel.',                                        true),
    ('workum',                             'Workum',                             'NL', 52.968506, 5.411324, '[{"from":203,"to":338}]'::jsonb, false, 'ijsselmeer',    'Drops off quickly; swimmers; sandbars.',                   true),
    ('schellinkhout',                      'Schellinkhout',                      'NL', 52.634099, 5.121483, '[{"from":158,"to":270}]'::jsonb, false, 'ijsselmeer',    'Swimmers.',                                                true),

    -- Wadden (islands + Waddenzee, tidal)
    ('texel-paal-9',                       'Texel Paal 9',                       'NL', 53.021161, 4.709989, '[{"from":203,"to":338}]'::jsonb, true,  'wadden',        'Tidal currents.',                                          true),
    ('ameland-noordzee-buren',             'Ameland Noordzee (Buren)',           'NL', 53.465025, 5.864553, '[{"from":270,"to":90}]'::jsonb,  true,  'wadden',        null,                                                       true),
    ('schiermonnikoog-noordzeekant-paal-3','Schiermonnikoog (Noordzeekant paal 3)','NL', 53.492973, 6.145967, '[{"from":270,"to":90}]'::jsonb, true, 'wadden',        null,                                                       true),
    ('vlieland',                           'Vlieland',                           'NL', 53.304070, 5.050656, '[{"from":270,"to":90}]'::jsonb,  true,  'wadden',        'Tidal currents; groynes.',                                 true),
    ('texel-paal-17',                      'Texel Paal 17',                      'NL', 53.081241, 4.736617, '[{"from":203,"to":23}]'::jsonb,  true,  'wadden',        'Sandbars.',                                                true),
    ('texel-vuurtoren',                    'Texel Vuurtoren',                    'NL', 53.183839, 4.855923, '[{"from":0,"to":360}]'::jsonb,   true,  'wadden',        'Tidal currents.',                                          true),
    ('lauwersoog',                         'Lauwersoog',                         'NL', 53.396500, 6.151620, '[{"from":270,"to":45}]'::jsonb,  true,  'wadden',        null,                                                       true),
    ('ameland-hollum',                     'Ameland (Hollum)',                   'NL', 53.439399, 5.639648, '[{"from":90,"to":293}]'::jsonb,  true,  'wadden',        'Strong currents; drops off quickly; advanced riders only.',true),
    ('terschelling-groene-strand',         'Terschelling Groene strand',         'NL', 53.356336, 5.209301, '[{"from":90,"to":270}]'::jsonb,  true,  'wadden',        'Tidal currents; shipping channel.',                        true),
    ('harlingen',                          'Harlingen',                          'NL', 53.166699, 5.416254, '[{"from":203,"to":338}]'::jsonb, true,  'wadden',        'Tidal currents.',                                          true),
    ('ameland-waddenzee',                  'Ameland Waddenzee',                  'NL', 53.438603, 5.775053, '[{"from":90,"to":270}]'::jsonb,  true,  'wadden',        'Tidal currents; shipping channel.',                        true),
    ('ameland-noordzee',                   'Ameland Noordzee',                   'NL', 53.460601, 5.711638, '[{"from":270,"to":90}]'::jsonb,  true,  'wadden',        'Tidal currents.',                                          true)
on conflict (slug) do nothing;


-- -----------------------------------------------------------------------------
-- 3. Backfill hazards on the 14 already-seeded spots where it's currently NULL
--    and the JSON dataset provides a value.
-- -----------------------------------------------------------------------------

update public.spots set hazards = 'Strong currents; drops off quickly.'                where slug = 'wijk-aan-zee-de-bunker' and hazards is null;
update public.spots set hazards = 'Sandbars.'                                          where slug = 'texel-paal-17'          and hazards is null;
update public.spots set hazards = 'Tidal currents.'                                    where slug = 'texel-vuurtoren'        and hazards is null;
update public.spots set hazards = 'Swimmers.'                                          where slug = 'schellinkhout'          and hazards is null;
update public.spots set hazards = 'Tidal currents; swimmers; surfers.'                 where slug = 'ijmuiden-zuidpier'      and hazards is null;
update public.spots set hazards = 'Tidal currents; drops off quickly; sandbars.'       where slug = 'egmond-aan-zee'         and hazards is null;
update public.spots set hazards = 'Strong currents; sandbars.'                         where slug = 'zandvoort'              and hazards is null;
update public.spots set hazards = 'Tidal currents; surfers.'                           where slug = 'noordwijk'              and hazards is null;
update public.spots set hazards = 'Drops off quickly; swimmers; sandbars.'             where slug = 'workum'                 and hazards is null;
update public.spots set hazards = 'Strong currents.'                                   where slug = 'bloemendaal'            and hazards is null;
