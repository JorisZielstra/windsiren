# Legacy — Python prototype

This directory contains the original WindSiren Python prototype. It was the
proof-of-concept: a GitHub Actions cron that emailed kitesurf condition alerts
for Dutch spots on Mon/Fri/Sat mornings.

**It is not run in production and is not part of the v0.1 build.**

Preserved for reference because:
- `constants/kitespots.json` — the seed data for the NL spot database (already
  migrated into `supabase/migrations/20260423130000_seed_nl_spots.sql`)
- `windsiren/notifications/kitesurf.py` — the original go/no-go decision logic,
  useful as a cross-check when building the TypeScript decision engine
- `windsiren/integration/openweathermap.py` — reference for the OpenWeatherMap
  response shape we'll wrap in the new `ForecastSource` adapter
- `cloud_functions/` — the old tracking-pixel + send-logging functions. Metrics
  architecture for v0.1 will be different (PostHog), but the patterns are
  instructive

To run or test anything in here you'll need Python 3.8+ and the dependencies in
`requirements.txt`. Treat as read-only reference.
