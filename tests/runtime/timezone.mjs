// Calendar helpers with real DST rules. Offsets are cached per UTC hour because the
// runtime asks for the same few hours thousands of times per scenario.

const MS_PER_MINUTE = 60_000;
const MS_PER_HOUR = 3_600_000;
const formatters = new Map();
const offsetCache = new Map();

function formatter(zone) {
  let value = formatters.get(zone);
  if (!value) {
    value = new Intl.DateTimeFormat('en-US', {
      timeZone: zone, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric',
    });
    formatters.set(zone, value);
  }
  return value;
}

const normalizedZones = new Map();
export function normalizeZone(zone) {
  let value = normalizedZones.get(zone);
  if (value === undefined) { value = parseZone(zone); normalizedZones.set(zone, value); }
  return value;
}

function parseZone(zone) {
  if (!zone || zone === 'Etc/UTC' || zone === 'UTC' || zone === 'GMT') return 'UTC';
  const offset = /^(?:UTC|GMT)([+-])(\d{1,2})(?::?(\d{2}))?$/.exec(zone);
  if (offset) return { fixed: (offset[1] === '-' ? -1 : 1) * (Number(offset[2]) * 60 + Number(offset[3] ?? 0)) * MS_PER_MINUTE };
  return zone;
}

export function zoneOffset(zone, utcMs) {
  const normalized = normalizeZone(zone);
  if (normalized === 'UTC') return 0;
  if (typeof normalized === 'object') return normalized.fixed;
  const bucket = Math.floor(utcMs / MS_PER_HOUR);
  let cache = offsetCache.get(normalized);
  if (!cache) { cache = new Map(); offsetCache.set(normalized, cache); }
  let offset = cache.get(bucket);
  if (offset === undefined) {
    const parts = Object.fromEntries(formatter(normalized).formatToParts(new Date(bucket * MS_PER_HOUR))
      .filter(part => part.type !== 'literal').map(part => [part.type, Number(part.value)]));
    offset = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second) - bucket * MS_PER_HOUR;
    cache.set(bucket, offset);
  }
  return offset;
}

// Civil date from a day count (Howard Hinnant's algorithm), avoiding Date allocation.
function civilFromDays(days) {
  const z = days + 719468;
  const era = Math.floor(z / 146097);
  const doe = z - era * 146097;
  const yoe = Math.floor((doe - Math.floor(doe / 1460) + Math.floor(doe / 36524) - Math.floor(doe / 146096)) / 365);
  const doy = doe - (365 * yoe + Math.floor(yoe / 4) - Math.floor(yoe / 100));
  const mp = Math.floor((5 * doy + 2) / 153);
  const day = doy - Math.floor((153 * mp + 2) / 5) + 1;
  const month = mp < 10 ? mp + 3 : mp - 9;
  return { year: yoe + era * 400 + (month <= 2 ? 1 : 0), month, day };
}

export function localParts(utcMs, zone) {
  const local = utcMs + zoneOffset(zone, utcMs);
  const days = Math.floor(local / 86_400_000);
  const msOfDay = local - days * 86_400_000;
  const { year, month, day } = civilFromDays(days);
  return {
    year, month, day,
    hour: Math.floor(msOfDay / MS_PER_HOUR), minute: Math.floor(msOfDay / MS_PER_MINUTE) % 60, second: Math.floor(msOfDay / 1000) % 60,
    dayOfWeek: ((days + 4) % 7 + 7) % 7 + 1,
  };
}

// Mirrors Pine's timestamp(): out-of-range fields roll over, and the wall time is resolved in the zone.
export function zonedTimestamp(zone, year, month, day, hour = 0, minute = 0, second = 0) {
  const wall = Date.UTC(year, month - 1, day, hour, minute, second);
  let guess = wall - zoneOffset(zone, wall);
  guess = wall - zoneOffset(zone, guess);
  return guess;
}
