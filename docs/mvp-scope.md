# WindSiren v0.1 — MVP Scope

## One-liner

> **The kite-first forecast app for Dutch kitesurfers.** Tells you when and where to go, tuned to your skill level.

## Target user

A Dutch-based kitesurfer — any skill from beginner to expert — who today checks Windy, Windguru, or Windfinder manually across multiple spots before deciding where to drive. They waste time translating generalist weather data into kite-specific decisions.

## Vision for v0.1

Ship a single, polished utility that replaces the manual "check five tabs on Saturday morning" ritual with one push notification and one screen. Earn the right to build community features later.

---

## In scope (ships in v0.1)

### Core data
- **Curated NL spot database** — hand-maintained list of ~20 Dutch kitesurf spots, each with: name, coordinates, safe wind direction window, local hazards/notes, tide sensitivity flag, nearest KNMI station ID. Seeded from the existing [kitespots.json](../constants/kitespots.json) and extended.
- **3-day forecast per spot**, covering: wind speed, gusts, wind direction, tide (high/low times + height), air temperature, water temperature, precipitation.
- **Real-time observations per spot** — live wind speed, gusts, direction, and temperature from the nearest weather station, refreshed every 10 minutes. Shown side-by-side with the forecast on the spot detail view. This is a genuine differentiator vs forecast-only apps: a kiter can confirm "is it actually happening right now?" before committing to drive.

### Decision engine
- **Go/no-go verdict per spot per day**, driven by the user's active profile.
- **Four profiles**:
  - *Beginner* — conservative wind band, low gust tolerance, no offshore directions, daylight only
  - *Intermediate* — wider wind band, moderate gust tolerance
  - *Expert* — full wind range, high gust tolerance, all directions the spot supports
  - *Personalized* — user sets their own min/max on wind, gusts, air temp, water temp, rain probability, tide state, per-direction preferences
- The decision rule is transparent — tapping a verdict shows *why* (which threshold passed/failed).

### Surfaces
- **Spot map** — NL map with spots pinned, colored by today's / tomorrow's verdict
- **Spot list** — ranked list sorted by best conditions in the next 3 days
- **Spot detail** — 3-day hourly breakdown with all weather metrics, verdict per day, RSVP button
- **Settings** — profile picker, personalized thresholds editor, notification preferences, account, billing

### Notifications
- **Push notifications** when a user's favorited spot turns green within their forecast window
- User controls: notification lead time (e.g. notify me 24h / 48h / 72h ahead), quiet hours, per-spot on/off

### Social (intentionally minimal)
- **"I'm going" RSVP** — toggle on a spot + date. Shows "3 kiters are planning to be here Saturday". Text only, no photos, no comments, no friends. This is the only social primitive in v0.1.

### Account & billing
- **Email + OAuth auth** (Google / Apple)
- **Free tier**: 1 favorited spot, full 3-day forecast, push on that spot, unlimited browsing
- **Paid tier**: unlimited favorited spots, notifications on all of them
- **Pricing** (identical on every platform — user always sees €3/mo annual or €10/mo monthly):
  - Web + Android: Stripe direct (~2.9% + €0.25)
  - iOS: Apple IAP — we absorb Apple's 15–30% cut as a margin hit rather than raising iOS prices or forcing web-first signup. Rationale: friction-free iOS onboarding matters more for adoption than per-user margin at this stage.

### Platforms
- **Native iOS**
- **Native Android**
- **Responsive web**

---

## Out of scope (explicitly deferred)

Deferred to v0.5 or later:
- Follows, friends, profiles
- User-submitted text condition reports ("22kn cross-on, sandbar open")
- Photo uploads, feeds, likes, comments
- Community-submitted spots + super-user validation flow
- Spots outside the Netherlands
- Wingfoil, windsurf, sailing, any non-kite sport
- Forecast horizon beyond 3 days
- Multi-user group chats / "crew" features
- Sponsored content, school/rental partnerships
- Offline mode / downloaded forecasts
- Apple Watch / Android Wear apps
- Public spot reviews / ratings

---

## Data sources (locked for v0.1)

All providers are accessed via a **provider-adapter layer** (see Architecture principles below), so any single source can be swapped without touching business logic.

| Purpose | Provider | Cost | Notes |
|---|---|---|---|
| Forecast (wind, temp, rain, gusts) | [OpenWeatherMap](https://openweathermap.org/) One Call API | Free tier → paid at scale | Already integrated in the prototype. Global coverage, fine for v0.1. |
| Tide times + height | [Rijkswaterstaat Waterinfo](https://waterinfo.rws.nl/) | Free | NL-only. Official authority. No API key. |
| Water temperature | Rijkswaterstaat (coastal buoys) + OpenWeatherMap fallback | Free | RWS is authoritative for NL coastal waters. |
| Real-time station observations | [KNMI Data Platform — 10-min in-situ observations](https://english.knmidata.nl/open-data/10-minute-in-situ-meteorological-observations) | Free (CC BY 4.0) | Government-authoritative. ~50 stations across NL including coastal sites. Updates every 10 min. Requires attribution. |
| Real-time supplementary / fallback | [Buienradar XML API](https://www.buienradar.nl/overbuienradar/gratis-weerdata) | Free (attribution) | Already aggregates KNMI + own network. Useful fallback if KNMI is down. |

**Post-NL global expansion** (v1.0+) — swap-in candidates already considered: [Stormglass](https://stormglass.io/) for marine/tide, [Open-Meteo](https://open-meteo.com/) for forecasts, [Meteoblue](https://www.meteoblue.com/) as premium all-in-one.

## Architecture principles (non-negotiable)

1. **Swappable data providers.** All weather/tide/observation data is accessed through internal interfaces (e.g. `ForecastSource`, `ObservationSource`, `TideSource`). Providers are implementations behind those interfaces. Swapping KNMI for something else must be a single-file change with no business-logic impact. Per-region provider routing is configuration, not code.
2. **Normalized internal data model.** Every provider adapter returns the same `Forecast` / `Observation` / `TidePoint` shapes with consistent units (m/s → stored internally; converted to knots at the UI edge). No provider-specific fields leak into the app layer.
3. **Decision engine is pure.** The go/no-go rule takes normalized data + a user's thresholds and returns a verdict. No I/O, no provider knowledge. Testable in isolation. Explainable (returns *which* threshold drove the decision).
4. **One source of truth per concept.** One spot = one row. One user's thresholds = one JSON blob. No replicated state across clients.

## Remaining open questions

1. **Notification infrastructure.** iOS push requires Apple Developer account (€99/yr) and APNs certs. Android push uses FCM (free). Web push is a distinct stack (VAPID). [Expo Notifications](https://docs.expo.dev/push-notifications/overview/) unifies all three — revisit when we pick stack.

2. **Legal/compliance.** EU GDPR requires privacy policy, DPA with all processors (weather APIs, Stripe, DB provider, push provider), cookie banner on web. Payment processing requires a legal entity (BV or sole proprietorship). You'll need to handle this in parallel with build — not Claude-scope.

---

## Success criteria for v0.1 (locked)

**Primary targets** — these are the goals v0.1 is built to hit:
- **100 weekly active NL kitesurfers** by end of the first full kite season post-launch
- **≥10% free→paid conversion** (measured: paid subscribers ÷ users who favorited a 2nd spot, since favoriting a 2nd spot is the paywall moment)

**Hard safety gate** — not a metric, a non-negotiable quality bar:
- **Zero incorrect "go" verdicts on unsafe conditions.** A false-positive "go" on a storm day is reputational poison for a kite app — and a liability risk. The decision engine must bias toward "no-go" when inputs are uncertain or missing. This is more important than any adoption metric.

---

## What this doc is for

This is the yardstick. When a feature request comes up between now and launch, the first question is: *does it fit in the In Scope list above, or does it belong in a later phase?* If the answer is "it's a gray area" we discuss; if the answer is "it's social / it's global / it's multi-sport" — it's v0.5+.

Last updated: 2026-04-23.
