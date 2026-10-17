import { addDays, subDays } from "date-fns";
import { fromZonedTime } from "date-fns-tz";
import type { ReminderKind } from "./types";

const SEND_HOUR = Number(process.env.REMINDER_SEND_HOUR_LOCAL ?? 10);

/** Calendar-day offsets from the due date. */
const OFFSETS: Record<Exclude<ReminderKind, "INITIAL_DISPATCH">, number> = {
  BEFORE_DUE_3D: -3,
  ON_DUE_DATE: 0,
  AFTER_DUE_2D: 2,
};

/**
 * Compute the UTC instant for SEND_HOUR local time in the org's timezone.
 * `dueDate` is a date-only value (Postgres DATE) - we read its Y/M/D in UTC to avoid TZ drift.
 */
export function computeRunAt(
  dueDate: Date,
  kind: Exclude<ReminderKind, "INITIAL_DISPATCH">,
  timezone: string,
): Date {
  const base = new Date(Date.UTC(dueDate.getUTCFullYear(), dueDate.getUTCMonth(), dueDate.getUTCDate()));
  const offset = OFFSETS[kind];
  const target = offset < 0 ? subDays(base, -offset) : addDays(base, offset);

  const y = target.getUTCFullYear();
  const m = String(target.getUTCMonth() + 1).padStart(2, "0");
  const d = String(target.getUTCDate()).padStart(2, "0");
  const hh = String(SEND_HOUR).padStart(2, "0");

  return fromZonedTime(`${y}-${m}-${d}T${hh}:00:00`, timezone);
}
