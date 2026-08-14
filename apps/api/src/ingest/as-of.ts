import type { Timeframe } from "@committee/contracts";

/**
 * ============================================================================
 * THE `as_of` RULE — the single most important thing in the L0 layer.
 * ============================================================================
 *
 * Two timestamps live on every `price_bars` row and they are NOT the same:
 *
 *   `ts`    — the bar's OPEN time (market time). What the datum is *about*.
 *   `as_of` — the moment the bar became KNOWABLE, i.e. the moment it was
 *             complete/final. What we were allowed to see.
 *
 * Every downstream query filters `WHERE as_of <= :decision_ts`. If `as_of` is
 * set too EARLY the whole system silently peeks into the future — a look-ahead
 * bug that no unit test above L0 can catch. If `as_of` is set too LATE we
 * merely delay availability. So the rule is: **when in doubt, later.**
 *
 * The exact rule implemented here:
 *
 *   1Hour → as_of = ts + 1 hour.
 *            An hourly bar opening at 14:00 is final at 15:00. Exact, and it
 *            holds for extended-hours bars too.
 *
 *   1Day  → as_of = the US equity regular-session close (16:00
 *            America/New_York) on the bar's own ET session date.
 *            NOT `ts` (which is the session open / midnight ET), and NOT
 *            "ts + 24h" (which would be later than necessary but also wrong on
 *            the other side: it would place the bar's availability on the next
 *            calendar day and hide a same-evening decision from real data).
 *            16:00 ET is 20:00Z under EDT and 21:00Z under EST; we resolve the
 *            real UTC instant per-bar via the IANA tz database so DST is exact.
 *            If tz resolution ever fails we fall back to 21:00Z on the ET date,
 *            which is the CONSERVATIVE (>=) bound in both DST regimes.
 *
 * NEVER IN THE FUTURE: a bar whose computed `as_of` is after "now" is not yet
 * final. We do NOT clamp it to `now` — clamping would make `as_of` earlier than
 * the truth, which is exactly the look-ahead bug. We DROP the bar instead and
 * report it as `dropped`. It will be picked up by the next ingest run.
 *
 * Half-day sessions (1:00pm ET early closes around holidays) are ingested with
 * as_of = 16:00 ET, i.e. LATER than the true close. Conservative, therefore
 * safe. Sprint 3's calendar work can tighten this; tightening is a look-ahead
 * risk and must be done deliberately, never as a drive-by.
 * ============================================================================
 */

/** IANA zone the US equity session is defined in. */
export const MARKET_TIMEZONE = "America/New_York";

/** Regular-session close, in market-local wall-clock time. */
export const SESSION_CLOSE_HOUR_ET = 16;
export const SESSION_CLOSE_MINUTE_ET = 0;

/**
 * Conservative fallback: 21:00Z == 16:00 EST. Under EDT the true close is
 * 20:00Z, so 21:00Z is one hour LATE — the safe direction.
 */
export const FALLBACK_SESSION_CLOSE_UTC_HOUR = 21;

const HOUR_MS = 60 * 60 * 1000;
const MINUTE_MS = 60 * 1000;

/** Offset of `MARKET_TIMEZONE` from UTC, in minutes, at the given instant. */
function marketOffsetMinutes(at: Date): number | null {
  try {
    const fmt = new Intl.DateTimeFormat("en-US", {
      timeZone: MARKET_TIMEZONE,
      timeZoneName: "longOffset",
    });
    const part = fmt.formatToParts(at).find((p) => p.type === "timeZoneName");
    if (!part) return null;
    // "GMT-05:00" | "GMT-5" | "GMT"
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

/** The y/m/d the given instant falls on, in market-local time. */
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
    // en-CA formats as YYYY-MM-DD.
    const [y, m, d] = fmt.format(at).split("-").map(Number);
    if (y === undefined || m === undefined || d === undefined) return null;
    if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return null;
    return { year: y, month: m, day: d };
  } catch {
    return null;
  }
}

/**
 * The UTC instant of `16:00 America/New_York` on the ET calendar date that
 * `barTs` falls on. Two-pass: guess with the offset in effect at `barTs`, then
 * re-resolve the offset at the guessed instant (handles the DST boundary).
 */
export function sessionCloseUtc(barTs: Date): Date {
  const date = marketCalendarDate(barTs);
  if (!date) {
    // Conservative fallback on the UTC date — 21:00Z >= true close year-round.
    return new Date(
      Date.UTC(
        barTs.getUTCFullYear(),
        barTs.getUTCMonth(),
        barTs.getUTCDate(),
        FALLBACK_SESSION_CLOSE_UTC_HOUR,
        0,
        0,
        0,
      ),
    );
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

  const firstOffset = marketOffsetMinutes(barTs);
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
    );
  }

  const firstGuess = new Date(wallClockUtc - firstOffset * MINUTE_MS);
  const secondOffset = marketOffsetMinutes(firstGuess);
  if (secondOffset === null || secondOffset === firstOffset) return firstGuess;
  return new Date(wallClockUtc - secondOffset * MINUTE_MS);
}

/**
 * The one function that decides when a bar became knowable.
 * See the module header for the full rule and its rationale.
 */
export function computeAsOf(barTs: Date, timeframe: Timeframe): Date {
  if (timeframe === "1Hour") {
    // An hourly bar opening at ts is final at the end of that hour.
    return new Date(barTs.getTime() + HOUR_MS);
  }
  // "1Day": final at the session close of its own trading day.
  return sessionCloseUtc(barTs);
}
