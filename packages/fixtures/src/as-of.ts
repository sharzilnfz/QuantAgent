/**
 * Timezone and session close helpers for stamping immutable as_of timestamps.
 */

export const MARKET_TIMEZONE = "America/New_York";
export const SESSION_CLOSE_HOUR_ET = 16;
export const SESSION_CLOSE_MINUTE_ET = 0;
export const FALLBACK_SESSION_CLOSE_UTC_HOUR = 21;

const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;

function marketOffsetMinutes(at: Date): number | null {
  try {
    const fmt = new Intl.DateTimeFormat("en-US", {
      timeZone: MARKET_TIMEZONE,
      timeZoneName: "longOffset",
    });
    const part = fmt.formatToParts(at).find((p) => p.type === "timeZoneName");
    if (!part) return null;
    const m = /GMT([+-])(\d{1,2})(?::?(\d{2}))?/.exec(part.value);
    if (!m) return part.value === "GMT" ? 0 : null;
    const sign = m[1] === "-" ? -1 : 1;
    const hours = Number(m[2] ?? 0);
    const minutes = Number(m[3] ?? 0);
    return sign * (hours * 60 + minutes);
  } catch {
    return null;
  }
}

function marketCalendarDate(
  at: Date,
): { year: number; month: number; day: number } | null {
  try {
    const fmt = new Intl.DateTimeFormat("en-CA", {
      timeZone: MARKET_TIMEZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    const [y, m, d] = fmt.format(at).split("-").map(Number);
    if (y === undefined || m === undefined || d === undefined) return null;
    if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return null;
    return { year: y, month: m, day: d };
  } catch {
    return null;
  }
}

/**
 * Computes the exact UTC session close instant (16:00 America/New_York) for a given bar timestamp.
 */
export function computeDailyBarAsOf(barTs: Date | string): string {
  const ts = typeof barTs === "string" ? new Date(barTs) : barTs;
  const date = marketCalendarDate(ts);
  if (!date) {
    return new Date(
      Date.UTC(
        ts.getUTCFullYear(),
        ts.getUTCMonth(),
        ts.getUTCDate(),
        FALLBACK_SESSION_CLOSE_UTC_HOUR,
        0,
        0,
        0,
      ),
    ).toISOString();
  }

  const wallClockUtc = Date.UTC(
    date.year,
    date.month - 1,
    date.day,
    SESSION_CLOSE_HOUR_ET,
    SESSION_CLOSE_MINUTE_ET,
    0,
    0,
  );

  const firstOffset = marketOffsetMinutes(ts);
  if (firstOffset === null) {
    return new Date(
      Date.UTC(
        date.year,
        date.month - 1,
        date.day,
        FALLBACK_SESSION_CLOSE_UTC_HOUR,
        0,
        0,
        0,
      ),
    ).toISOString();
  }

  const firstGuess = new Date(wallClockUtc - firstOffset * MINUTE_MS);
  const secondOffset = marketOffsetMinutes(firstGuess);
  const finalDate = secondOffset === null || secondOffset === firstOffset
    ? firstGuess
    : new Date(wallClockUtc - secondOffset * MINUTE_MS);

  return finalDate.toISOString();
}

/**
 * For news items, the moment it is knowable is its publication instant.
 */
export function computeNewsAsOf(publishedAt: Date | string): string {
  const ts = typeof publishedAt === "string" ? new Date(publishedAt) : publishedAt;
  return ts.toISOString();
}
