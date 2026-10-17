import { Queue, type JobsOptions } from "bullmq";
import { prisma } from "@/lib/prisma";
import { getRedisConnection } from "./connection";
import { computeRunAt } from "./schedule";
import { COMPRESSED_REMINDER_SEQUENCE } from "@/lib/reminder-sequence";
import {
  REMINDER_QUEUE_NAME,
  jobIdFor,
  REMINDER_KINDS,
  type ReminderJobData,
  type ReminderKind,
} from "./types";

let reminderQueue: Queue<ReminderJobData> | undefined;

export function getReminderQueue() {
  reminderQueue ??= new Queue<ReminderJobData>(REMINDER_QUEUE_NAME, {
    connection: getRedisConnection(),
    defaultJobOptions: {
      attempts: 5,
      backoff: { type: "exponential", delay: 30_000 },
      removeOnComplete: { age: 7 * 24 * 3600, count: 5000 },
      removeOnFail: { age: 30 * 24 * 3600 },
    },
  });
  return reminderQueue;
}

/**
 * Schedule the full sequence for one invoice. Idempotent:
 * - DB rows are upserted on (invoiceId, kind)
 * - BullMQ ignores add() when a job with the same jobId already exists
 * Reminders whose time is already in the past are skipped (we don't spam a
 * "3 days before" message for an invoice due tomorrow).
 */
export async function scheduleInvoiceSequence(invoiceId: string): Promise<void> {
  const invoice = await prisma.invoice.findUniqueOrThrow({
    where: { id: invoiceId },
    include: { organization: { select: { timezone: true } } },
  });

  if (invoice.status === "PAID" || invoice.status === "CANCELLED") return;

  const now = Date.now();
  const plan: { kind: ReminderKind; runAt: Date }[] = process.env.DEMO_TIME_COMPRESSION === "true"
    ? COMPRESSED_REMINDER_SEQUENCE.map(({ kind, offsetMs }) => ({
      kind,
      runAt: new Date(now + offsetMs),
    }))
    : [
      { kind: "INITIAL_DISPATCH", runAt: new Date(now) },
      ...(["BEFORE_DUE_3D", "ON_DUE_DATE", "AFTER_DUE_2D"] as const)
        .map((kind) => ({ kind, runAt: computeRunAt(invoice.dueDate, kind, invoice.organization.timezone) }))
        .filter((reminder) => reminder.runAt.getTime() > now),
    ];

  for (const { kind, runAt } of plan) {
    const bullJobId = jobIdFor(invoiceId, kind);

    const schedule = await prisma.reminderSchedule.upsert({
      where: { invoiceId_kind: { invoiceId, kind } },
      create: { invoiceId, kind, runAt, bullJobId },
      update: {}, // never reset state of an already-handled reminder
    });
    if (schedule.state !== "SCHEDULED") continue;

    const opts: JobsOptions = {
      jobId: bullJobId,
      delay: Math.max(0, runAt.getTime() - now),
    };
    await getReminderQueue().add(
      kind,
      { invoiceId, organizationId: invoice.organizationId, kind },
      opts,
    );
  }
}

/**
 * Stop everything for an invoice. Call from:
 *  - Razorpay payment.captured webhook
 *  - WhatsApp "Already Paid" button handler
 *  - manual mark-paid / cancel in dashboard
 *
 * Removal handles delayed/waiting jobs. A job that is *active right now* cannot be
 * removed - the worker's fire-time guard (status re-check) covers that race.
 */
export async function cancelInvoiceReminders(
  invoiceId: string,
  reason: "PAID" | "PENDING_VERIFICATION" | "CANCELLED",
): Promise<{ removed: number; busy: number }> {
  let removed = 0;
  let busy = 0;

  await Promise.all(
    REMINDER_KINDS.map(async (kind) => {
      const job = await getReminderQueue().getJob(jobIdFor(invoiceId, kind));
      if (!job) return;
      try {
        await job.remove();
        removed++;
      } catch {
        busy++; // locked/active; worker guard will skip it
      }
    }),
  );

  await prisma.reminderSchedule.updateMany({
    where: { invoiceId, state: "SCHEDULED" },
    data: { state: "CANCELLED", skipReason: reason },
  });

  return { removed, busy };
}

/**
 * Resume after the owner rejects an "Already Paid" claim: re-add only future reminders.
 */
export async function resumeInvoiceReminders(invoiceId: string): Promise<void> {
  await prisma.reminderSchedule.deleteMany({
    where: { invoiceId, state: "CANCELLED", kind: { not: "INITIAL_DISPATCH" } },
  });
  for (const kind of REMINDER_KINDS) {
    if (kind === "INITIAL_DISPATCH") continue;
    const job = await getReminderQueue().getJob(jobIdFor(invoiceId, kind));
    if (job) await job.remove().catch(() => undefined);
  }
  await scheduleInvoiceSequence(invoiceId);
}

/**
 * Safety net: run on boot + every 15 min via a repeatable job. If Redis was flushed,
 * rebuild any SCHEDULED rows missing from the queue.
 */
export async function reconcileQueueWithDb(): Promise<number> {
  const rows = await prisma.reminderSchedule.findMany({
    where: { state: "SCHEDULED", invoice: { status: { in: ["PENDING", "REMINDER_ACTIVE"] } } },
    include: { invoice: { select: { organizationId: true } } },
  });

  let restored = 0;
  for (const r of rows) {
    const existing = await getReminderQueue().getJob(r.bullJobId);
    if (existing) continue;
    await getReminderQueue().add(
      r.kind,
      { invoiceId: r.invoiceId, organizationId: r.invoice.organizationId, kind: r.kind },
      { jobId: r.bullJobId, delay: Math.max(0, r.runAt.getTime() - Date.now()) },
    );
    restored++;
  }
  return restored;
}
