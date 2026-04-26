-- Macro-region classification for spots, used by the /spots filter UI.
-- Five buckets cover NL kite geography: the Wadden islands, North Holland
-- coast, South Holland coast, Zeeland delta, and the inland IJsselmeer
-- lake system. Spots without a region default to NULL (filter chip
-- "(unset)" for those).
--
-- A future migration can split this further (e.g. Markermeer vs IJsselmeer
-- proper) once we have enough spots to make the distinction useful.

alter table public.spots
    add column if not exists region text;

alter table public.spots
    add constraint spots_region_check
    check (
        region is null
        or region in ('wadden', 'north_holland', 'south_holland', 'zeeland', 'ijsselmeer')
    );

-- Backfill the 14 seeded spots. New spots get NULL until classified.
update public.spots
set region = case slug
    when 'paal-17-texel'   then 'wadden'
    when 'waddenzee-texel' then 'wadden'
    when 'wijk-aan-zee'    then 'north_holland'
    when 'ijmuiden'        then 'north_holland'
    when 'egmond-aan-zee'  then 'north_holland'
    when 'zandvoort'       then 'north_holland'
    when 'bloemendaal'     then 'north_holland'
    when 'noordwijk'       then 'south_holland'
    when 'andijk'          then 'ijsselmeer'
    when 'schellinkhout'   then 'ijsselmeer'
    when 'hoekipa-dijk'    then 'ijsselmeer'
    when 'workum'          then 'ijsselmeer'
    when 'medemblik'       then 'ijsselmeer'
    when 'monnickendam'    then 'ijsselmeer'
    else region
end
where region is null;

create index if not exists spots_region_idx on public.spots (region);
