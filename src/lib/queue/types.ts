export type ReminderKind =
  | "INITIAL_DISPATCH"
  | "BEFORE_DUE_3D"
  | "ON_DUE_DATE"
  | "AFTER_DUE_2D";

export const REMINDER_KINDS: ReminderKind[] = [
  "INITIAL_DISPATCH",
  "BEFORE_DUE_3D",
  "ON_DUE_DATE",
  "AFTER_DUE_2D",
];

/** Payload is intentionally minimal: the worker re-reads fresh state from the DB. */
export interface ReminderJobData {
  invoiceId: string;
  organizationId: string;
  kind: ReminderKind;
}

export const REMINDER_QUEUE_NAME = "invoice-reminders";

/**
 * BullMQ forbids ":" in custom job ids, so use "__".
 * Deterministic ids give us: (a) idempotent scheduling (re-adding is a no-op),
 * (b) cheap targeted removal on payment.
 */
export const jobIdFor = (invoiceId: string, kind: ReminderKind) =>
  `rem__${invoiceId}__${kind}`;
