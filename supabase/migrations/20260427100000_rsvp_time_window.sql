-- Add an optional 2-hour time window to rsvps so kiters can plan
-- specific time slots ("I'm going Saturday 10–12") rather than just
-- claiming a whole day. NULL = all-day, the previous semantics.
--
-- Window is stored as the slot's *start hour* in 24h NL local time, even
-- numbers only (so 0/2/4/.../22). The UI renders the slot as
-- `start..start+2`. Storing only the start keeps the schema small and
-- the chip set finite (12 slots).
alter table public.rsvps
  add column if not exists planned_window_start_hour smallint;

alter table public.rsvps
  add constraint rsvps_window_even_check
    check (
      planned_window_start_hour is null
      or (
        planned_window_start_hour >= 0
        and planned_window_start_hour <= 22
        and planned_window_start_hour % 2 = 0
      )
    );

-- Drop the old (user, spot, date) unique so a kiter can pencil in
-- multiple windows for the same day.
alter table public.rsvps
  drop constraint if exists rsvps_user_id_spot_id_planned_date_key;

create unique index if not exists rsvps_user_spot_date_window_uniq
  on public.rsvps (
    user_id,
    spot_id,
    planned_date,
    coalesce(planned_window_start_hour, -1)
  );
