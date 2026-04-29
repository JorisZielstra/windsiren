-- Personal kite-condition thresholds. Lets each user override the
-- shared default profile (15 kn min wind / 35 kn max gust / 5°C / 8°C
-- water) with their own numbers, and feed those into every GO/MAYBE/
-- NO_GO decision the app renders for them.
--
-- All four columns are NULLABLE so the user can leave any unset; the
-- app side resolves null to "no constraint" for gust/temperatures and
-- to a hard-coded 15 kn for the wind-min specifically (per product
-- decision: "if minimum wind is not updated it should be 15 knots").
--
-- Stored in knots / Celsius — the units a kiter actually thinks in,
-- not the m/s the engine consumes. The conversion happens once in
-- `prefsToThresholds` so persistence stays human-readable.
alter table public.users
  add column if not exists pref_min_wind_kn       smallint,
  add column if not exists pref_max_gust_kn       smallint,
  add column if not exists pref_min_air_temp_c    smallint,
  add column if not exists pref_min_water_temp_c  smallint;

-- Sanity bounds. The engine clamps anyway, but a CHECK keeps junk
-- out of the table from a bad client.
alter table public.users
  add constraint users_pref_min_wind_kn_check
    check (pref_min_wind_kn is null or (pref_min_wind_kn between 1 and 60));

alter table public.users
  add constraint users_pref_max_gust_kn_check
    check (pref_max_gust_kn is null or (pref_max_gust_kn between 1 and 100));

alter table public.users
  add constraint users_pref_min_air_temp_c_check
    check (pref_min_air_temp_c is null or (pref_min_air_temp_c between -20 and 50));

alter table public.users
  add constraint users_pref_min_water_temp_c_check
    check (pref_min_water_temp_c is null or (pref_min_water_temp_c between 0 and 35));
