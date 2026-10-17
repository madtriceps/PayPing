import { Worker, UnrecoverableError, type Job } from "bullmq";
import { prisma } from "@/lib/prisma";
import { getRedisConnection } from "@/lib/queue/connection";
import { REMINDER_QUEUE_NAME, type ReminderJobData, type ReminderKind } from "@/lib/queue/types";
import { reconcileQueueWithDb } from "@/lib/queue/reminder.queue";
import { ensurePaymentLink } from "@/lib/razorpay/payment-link"; // creates/reuses link, stores rzpShortUrl
import { whatsappSender } from "@/lib/whatsapp";
import { renderMessageBody } from "@/lib/whatsapp/render-message";
import { PermanentSendError, RetryableSendError } from "@/lib/whatsapp/sender";

type SkipReason = "INVOICE_NOT_ACTIVE" | "ORG_PAUSED" | "CLIENT_OPTED_OUT" | "MISSING";

const fmtINR = (paise: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(paise / 100);

const fmtDate = (d: Date) =>
  d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" });

async function markSkipped(invoiceId: string, kind: ReminderKind, reason: SkipReason) {
  await prisma.reminderSchedule.update({
    where: { invoiceId_kind: { invoiceId, kind } },
    data: { state: "SKIPPED", skipReason: reason, firedAt: new Date() },
  });
  return { skipped: reason };
}

async function processReminder(job: Job<ReminderJobData>) {
  const { invoiceId, kind } = job.data;

  // ── 1. FIRE-TIME GUARD: always trust the DB over the queue payload ──
  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: { client: true, organization: { select: { sendingPaused: true } } },
  });
  if (!invoice) return { skipped: "MISSING" as const };

  const activeStatuses = ["PENDING", "REMINDER_ACTIVE"];
  if (!activeStatuses.includes(invoice.status)) return markSkipped(invoiceId, kind, "INVOICE_NOT_ACTIVE");
  if (invoice.organization.sendingPaused) return markSkipped(invoiceId, kind, "ORG_PAUSED");
  if (invoice.client.waOptedOut) return markSkipped(invoiceId, kind, "CLIENT_OPTED_OUT");

  // ── 2. Ensure payment link (idempotent: reuses existing rzpShortUrl) ──
  const paymentUrl = await ensurePaymentLink(invoice.id);

  const msPerDay = 86_400_000;
  const todayUtc = Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate());
  const daysToDue = Math.round((invoice.dueDate.getTime() - todayUtc) / msPerDay);

  // ── 3. Send ──
  try {
    const messageInput = {
      organizationId: invoice.organizationId,
      toE164: invoice.client.phoneE164,
      template: kind === "INITIAL_DISPATCH" ? "INVOICE" : "REMINDER",
      params: {
        clientName: invoice.client.name,
        invoiceNumber: invoice.invoiceNumber,
        amountFormatted: fmtINR(invoice.amountPaise),
        dueDateFormatted: fmtDate(invoice.dueDate),
        paymentUrl,
        pdfUrl: invoice.pdfUrl,
        daysToDue,
      },
    } as const;
    const { waMessageId } = await whatsappSender.sendTemplate(messageInput);

    // ── 4. Persist result atomically ──
    await prisma.$transaction([
      prisma.messageLog.create({
        data: {
          invoiceId,
          organizationId: invoice.organizationId,
          direction: "OUTBOUND",
          kind,
          body: renderMessageBody(messageInput),
          waMessageId,
          status: "SENT",
        },
      }),
      prisma.reminderSchedule.update({
        where: { invoiceId_kind: { invoiceId, kind } },
        data: { state: "SENT", firedAt: new Date(), attempts: job.attemptsMade + 1, lastError: null },
      }),
      // Guarded update: never overwrite PAID/PENDING_VERIFICATION set by a webhook mid-flight
      prisma.invoice.updateMany({
        where: { id: invoiceId, status: { in: ["PENDING", "REMINDER_ACTIVE"] } },
        data: { status: "REMINDER_ACTIVE" },
      }),
    ]);

    return { sent: waMessageId };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await prisma.reminderSchedule.update({
      where: { invoiceId_kind: { invoiceId, kind } },
      data: { attempts: job.attemptsMade + 1, lastError: message.slice(0, 500) },
    });

    if (err instanceof PermanentSendError) {
      throw new UnrecoverableError(message); // skip retries → goes to 'failed' handler
    }
    if (err instanceof RetryableSendError) throw err;
    throw err; // unknown errors: let BullMQ retry with backoff
  }
}

export function startReminderWorker() {
  const worker = new Worker<ReminderJobData>(REMINDER_QUEUE_NAME, processReminder, {
    connection: getRedisConnection(),
    concurrency: Number(process.env.WORKER_CONCURRENCY ?? 5),
    limiter: { max: Number(process.env.WA_RATE_LIMIT_PER_SECOND ?? 40), duration: 1000 },
  });

  worker.on("failed", async (job, err) => {
    if (!job) return;
    const finalFailure = job.attemptsMade >= (job.opts.attempts ?? 1) || err instanceof UnrecoverableError;
    if (!finalFailure) return;

    const { invoiceId, kind } = job.data;
    await prisma.reminderSchedule
      .update({
        where: { invoiceId_kind: { invoiceId, kind } },
        data: { state: "FAILED", lastError: err.message.slice(0, 500), firedAt: new Date() },
      })
      .catch(() => undefined);

    // A failed *initial dispatch* means the client never got the invoice → surface it to the owner
    if (kind === "INITIAL_DISPATCH") {
      await prisma.invoice.updateMany({
        where: { id: invoiceId, status: "PENDING" },
        data: { status: "FAILED", lastFailureReason: err.message.slice(0, 500) },
      });
    }
  });

  worker.on("error", (err) => console.error("[reminder-worker] error", err));

  // Rebuild queue from DB on boot, then periodically
  reconcileQueueWithDb()
    .then((n) => n && console.log(`[reminder-worker] restored ${n} jobs from DB`))
    .catch(console.error);
  setInterval(() => reconcileQueueWithDb().catch(console.error), 15 * 60_000).unref();

  const shutdown = async () => {
    await worker.close();
    process.exit(0);
  };
  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);

  return worker;
}
