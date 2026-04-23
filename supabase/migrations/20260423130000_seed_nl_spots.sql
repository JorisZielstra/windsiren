-- =============================================================================
-- WindSiren v0.1 — Seed NL kitesurf spots
--
-- Sourced from constants/kitespots.json (prototype data).
-- knmi_station_id + rws_tide_station_id are deliberately NULL here —
-- populated in a later migration once the adapter code verifies nearest
-- stations against the KNMI / Rijkswaterstaat APIs.
--
-- Idempotent: re-running skips existing slugs.
-- =============================================================================

insert into public.spots
    (slug, name, country_code, lat, lng, safe_wind_directions, tide_sensitive, active)
values
    ('wijk-aan-zee',    'Wijk aan Zee',    'NL', 52.482630, 4.581581, '[{"from":240,"to":10}]'::jsonb,  true,  true),
    ('paal-17-texel',   'Paal 17 Texel',   'NL', 53.081422, 4.736081, '[{"from":200,"to":20}]'::jsonb,  true,  true),
    ('waddenzee-texel', 'Waddenzee Texel', 'NL', 53.167006, 4.874932, '[{"from":0,"to":160}]'::jsonb,   true,  true),
    ('andijk',          'Andijk',          'NL', 52.739615, 5.176999, '[{"from":330,"to":90}]'::jsonb,  false, true),
    ('schellinkhout',   'Schellinkhout',   'NL', 52.633241, 5.121027, '[{"from":160,"to":270}]'::jsonb, false, true),
    ('ijmuiden',        'IJmuiden',        'NL', 52.456281, 4.559704, '[{"from":170,"to":335}]'::jsonb, true,  true),
    ('hoekipa-dijk',    'Hoekipa Dijk',    'NL', 52.526670, 5.425336, '[{"from":230,"to":40}]'::jsonb,  false, true),
    ('egmond-aan-zee',  'Egmond aan Zee',  'NL', 52.613790, 4.617561, '[{"from":210,"to":0}]'::jsonb,   true,  true),
    ('zandvoort',       'Zandvoort',       'NL', 52.383078, 4.528163, '[{"from":230,"to":10}]'::jsonb,  true,  true),
    ('noordwijk',       'Noordwijk',       'NL', 52.249958, 4.431479, '[{"from":200,"to":20}]'::jsonb,  true,  true),
    ('workum',          'Workum',          'NL', 52.967780, 5.411370, '[{"from":200,"to":340}]'::jsonb, false, true),
    ('medemblik',       'Medemblik',       'NL', 52.755110, 5.124056, '[{"from":0,"to":90}]'::jsonb,    false, true),
    ('bloemendaal',     'Bloemendaal',     'NL', 52.406538, 4.543369, '[{"from":230,"to":10}]'::jsonb,  true,  true),
    ('monnickendam',    'Monnickendam',    'NL', 52.455986, 5.050269, '[{"from":20,"to":180}]'::jsonb,  false, true)
on conflict (slug) do nothing;
