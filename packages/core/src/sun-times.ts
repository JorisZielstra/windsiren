// Sunrise / sunset calculation using the standard astronomical algorithm
// (NOAA / "Almanac for Computers" approximation). Accurate to ~1 minute,
// which is fine for "is it daylight?" UI badges. Pure function, no deps,
// no HTTP.
//
// Why inline rather than an Open-Meteo daily fetch: keeps the dashboard
// render path off the critical path of an extra HTTP round-trip; works
// offline; and the math is the same regardless of forecast provider.

const ZENITH_OFFICIAL = 90.833; // 90° + atmospheric refraction + solar disc.

export function getSunTimes(
  lat: number,
  lng: number,
  date: Date,
): { sunrise: Date; sunset: Date } {
  // Day of year (1-365 or 1-366).
  const start = Date.UTC(date.getUTCFullYear(), 0, 0);
  const dayOfYear = Math.floor(
    (Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) -
      start) /
      86400000,
  );

  return {
    sunrise: solarEvent(lat, lng, dayOfYear, date.getUTCFullYear(), "rise"),
    sunset: solarEvent(lat, lng, dayOfYear, date.getUTCFullYear(), "set"),
  };
}

function solarEvent(
  lat: number,
  lng: number,
  dayOfYear: number,
  year: number,
  kind: "rise" | "set",
): Date {
  const lngHour = lng / 15;

  // Approximate time of event.
  const t = kind === "rise" ? dayOfYear + (6 - lngHour) / 24 : dayOfYear + (18 - lngHour) / 24;

  // Sun's mean anomaly.
  const M = 0.9856 * t - 3.289;

  // Sun's true longitude.
  let L =
    M +
    1.916 * Math.sin(toRad(M)) +
    0.020 * Math.sin(toRad(2 * M)) +
    282.634;
  L = wrap(L, 360);

  // Sun's right ascension, adjusted to same quadrant as L.
  let RA = toDeg(Math.atan(0.91764 * Math.tan(toRad(L))));
  RA = wrap(RA, 360);
  const Lquadrant = Math.floor(L / 90) * 90;
  const RAquadrant = Math.floor(RA / 90) * 90;
  RA = RA + (Lquadrant - RAquadrant);
  RA = RA / 15; // hours.

  // Sun's declination.
  const sinDec = 0.39782 * Math.sin(toRad(L));
  const cosDec = Math.cos(Math.asin(sinDec));

  // Local hour angle.
  const cosH =
    (Math.cos(toRad(ZENITH_OFFICIAL)) - sinDec * Math.sin(toRad(lat))) /
    (cosDec * Math.cos(toRad(lat)));

  // Polar day / night clamp — return midday/midnight rather than NaN.
  if (cosH > 1) {
    return new Date(Date.UTC(year, 0, dayOfYear, 0, 0, 0));
  }
  if (cosH < -1) {
    return new Date(Date.UTC(year, 0, dayOfYear, 12, 0, 0));
  }

  let H =
    kind === "rise"
      ? 360 - toDeg(Math.acos(cosH))
      : toDeg(Math.acos(cosH));
  H = H / 15;

  // Local mean time of event (hours).
  const T = H + RA - 0.06571 * t - 6.622;

  // Convert to UTC.
  let UT = T - lngHour;
  UT = wrap(UT, 24);

  const hours = Math.floor(UT);
  const minutes = Math.floor((UT - hours) * 60);
  const seconds = Math.round((((UT - hours) * 60) - minutes) * 60);

  return new Date(Date.UTC(year, 0, dayOfYear, hours, minutes, seconds));
}

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

function toDeg(rad: number): number {
  return (rad * 180) / Math.PI;
}

function wrap(x: number, mod: number): number {
  return ((x % mod) + mod) % mod;
}
