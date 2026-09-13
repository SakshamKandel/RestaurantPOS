/**
 * Business-day boundary helpers.
 *
 * Restaurants often close after midnight, so a "day" isn't always the calendar
 * day. `businessDayCutoff` (Settings, hour 0–23) marks when one business day
 * rolls into the next — sales before that hour belong to the previous day.
 * 0 = plain calendar days. Everywhere the app says "today" should use these
 * helpers so the dashboard, reports and order line agree.
 */

/** Cutoff hour clamped to 0–23, expressed in milliseconds. */
export const bizDayCutoffMs = (cutoffHour: number) =>
  Math.min(23, Math.max(0, cutoffHour ?? 0)) * 3600_000

/** Local-midnight timestamp of the business day `ts` belongs to. */
export const businessDayOf = (ts: number, cutoffHour: number) => {
  const d = new Date(ts - bizDayCutoffMs(cutoffHour))
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
}

/** True when `ts` falls inside the business day containing `now`. */
export const isCurrentBusinessDay = (ts: number, cutoffHour: number, now = Date.now()) =>
  businessDayOf(ts, cutoffHour) === businessDayOf(now, cutoffHour)
