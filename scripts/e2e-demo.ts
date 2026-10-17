import "dotenv/config";
import { createHmac, randomUUID } from "node:crypto";
import { addDays, format } from "date-fns";
import { prisma } from "../src/lib/prisma";
import { getRedisConnection } from "../src/lib/queue/connection";
import { getReminderQueue } from "../src/lib/queue/reminder.queue";
import { REMINDER_KINDS, jobIdFor } from "../src/lib/queue/types";

const baseUrl = process.env.DEMO_BASE_URL ?? "http://localhost:3000";
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function postJson(path: string, payload?: unknown): Promise<Response> {
  return fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: payload === undefined ? {} : { "Content-Type": "application/json" },
    body: payload === undefined ? undefined : JSON.stringify(payload),
  });
}

async function sendSignedPayment(invoiceId: string, amount: number, eventId: string): Promise<Response> {
  const secret = process.env.DEMO_WEBHOOK_SECRET;
  if (!secret) throw new Error("DEMO_WEBHOOK_SECRET is required.");
  const body = JSON.stringify({
    event: "payment.captured",
    payload: {
      payment: {
        entity: {
          id: `pay_${randomUUID().replaceAll("-", "")}`,
          amount,
          currency: "INR",
          notes: { reference_id: invoiceId },
        },
      },
    },
  });
  const signature = createHmac("sha256", secret).update(body).digest("hex");
  return fetch(`${baseUrl}/api/webhooks/razorpay`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-razorpay-signature": signature,
      "x-razorpay-event-id": eventId,
    },
    body,
  });
}

async function waitFor(predicate: () => Promise<boolean>, description: string, timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await predicate()) return;
    await wait(500);
  }
  throw new Error(`Timed out waiting for ${description}.`);
}

async function cleanE2eBatches() {
  const batches = await prisma.uploadBatch.findMany({
    where: { fileName: { startsWith: "e2e-" } },
    select: { id: true, invoices: { select: { id: true } } },
  });
  const invoiceIds = batches.flatMap((batch) => batch.invoices.map((invoice) => invoice.id));
  for (const invoiceId of invoiceIds) {
    for (const kind of REMINDER_KINDS) {
      const job = await getReminderQueue().getJob(jobIdFor(invoiceId, kind));
      if (!job) continue;
      let state = await job.getState();
      for (let attempt = 0; state === "active" && attempt < 40; attempt++) {
        await wait(250);
        state = await job.getState();
      }
      if (state === "active") throw new Error(`Cannot clean E2E invoice ${invoiceId}: ${kind} remained active.`);
      await job.remove();
    }
  }
  if (invoiceIds.length) {
    await prisma.messageLog.deleteMany({ where: { invoiceId: { in: invoiceIds } } });
    await prisma.invoice.deleteMany({ where: { id: { in: invoiceIds } } });
  }
  if (batches.length) {
    await prisma.webhookEvent.deleteMany({ where: { externalId: { startsWith: "e2e-" } } });
    await prisma.uploadBatch.deleteMany({ where: { id: { in: batches.map((batch) => batch.id) } } });
  }
}

async function main() {
  if (process.env.DEMO_MODE !== "true" || process.env.DEMO_TIME_COMPRESSION !== "true") {
    throw new Error("Set DEMO_MODE=true and DEMO_TIME_COMPRESSION=true to run the demo E2E script.");
  }
  await cleanE2eBatches();
  const suffix = randomUUID().slice(0, 8);
  const dates = [1, 3, 5, -1, 60].map((offset) => format(addDays(new Date(), offset), "yyyy-MM-dd"));
  const rows = [
    ["Aarav Mehta", "9876543210", "E2E-A", "12500.00", dates[0]],
    ["Diya Shah", "9876543211", "E2E-B", "8750.50", dates[1]],
    ["Kabir Rao", "9876543212", "E2E-C", "24000", dates[2]],
    ["Meera Iyer", "9876543213", "E2E-D", "4600.00", dates[3]],
    ["Ishaan Patel", "9876543214", "E2E-E", "13250.75", dates[4]],
  ];
  const csv = [
    "client_name,client_phone,invoice_number,amount,due_date",
    ...rows.map((row) => [row[0], row[1], `${row[2]}-${suffix}`, row[3], row[4]].join(",")),
  ].join("\n");
  const formData = new FormData();
  formData.append("file", new Blob([csv], { type: "text/csv" }), `e2e-${suffix}.csv`);
  const upload = await fetch(`${baseUrl}/api/invoices/upload`, { method: "POST", body: formData });
  const uploadResult = await upload.json() as { created?: number; error?: string };
  assert(upload.ok && uploadResult.created === 5, `CSV upload failed: ${JSON.stringify(uploadResult)}`);

  const invoiceNumbers = rows.map((row) => `${row[2]}-${suffix}`);
  const invoices = await prisma.invoice.findMany({
    where: { invoiceNumber: { in: invoiceNumbers } },
    include: { client: true },
  });
  assert(invoices.length === 5, `Expected 5 test invoices; found ${invoices.length}.`);
  const byNumber = new Map(invoices.map((invoice) => [invoice.invoiceNumber.split("-")[1], invoice]));
  const invoiceA = byNumber.get("A");
  const invoiceB = byNumber.get("B");
  const invoiceC = byNumber.get("C");
  assert(invoiceA && invoiceB && invoiceC, "Could not identify test invoices A, B, and C.");

  await waitFor(async () => {
    const count = await prisma.messageLog.count({
      where: { invoiceId: { in: invoices.map((invoice) => invoice.id) }, kind: "INITIAL_DISPATCH", status: "SENT" },
    });
    return count === 5;
  }, "initial dispatch for all five invoices", 15_000);
  const initialLogs = await prisma.messageLog.findMany({
    where: { invoiceId: { in: invoices.map((invoice) => invoice.id) }, kind: "INITIAL_DISPATCH", status: "SENT" },
    select: { body: true },
  });
  assert(
    initialLogs.every((log) => Boolean(log.body?.includes("Invoice E2E-") && log.body.includes("Amount:") && log.body.includes("Due date:") && log.body.includes("Pay securely: http://localhost:3000/pay/"))),
    "Initial demo message logs are missing rendered invoice, amount, due-date, or payment-link content.",
  );
  console.log("PASS: uploaded five invoices and observed all five initial sends.");

  const eventId = `e2e-${suffix}`;
  const firstPayment = await sendSignedPayment(invoiceA.id, invoiceA.amountPaise, eventId);
  assert(firstPayment.ok, `Payment webhook failed: ${await firstPayment.text()}`);
  const duplicatePayment = await sendSignedPayment(invoiceA.id, invoiceA.amountPaise, eventId);
  assert(duplicatePayment.ok, `Duplicate webhook failed: ${await duplicatePayment.text()}`);
  const thanksCount = await prisma.messageLog.count({
    where: { invoiceId: invoiceA.id, kind: "THANKS" },
  });
  assert(thanksCount === 1, `Expected exactly one thank-you message; found ${thanksCount}.`);
  const thankYou = await prisma.messageLog.findFirst({
    where: { invoiceId: invoiceA.id, kind: "THANKS" },
    select: { body: true },
  });
  assert(Boolean(thankYou?.body?.includes("Thanks, Aarav Mehta.") && thankYou.body.includes(invoiceA.invoiceNumber)), "Thank-you log is missing rendered payment confirmation.");
  const paidConversationResponse = await fetch(`${baseUrl}/api/clients/${encodeURIComponent(invoiceA.clientId)}/messages`);
  assert(paidConversationResponse.ok, "Could not fetch the paid client's simulated conversation.");
  const paidConversation = await paidConversationResponse.json() as { messages: { kind: string; body: string | null; invoice: { id: string } | null }[] };
  assert(paidConversation.messages.some((message) => message.kind === "THANKS" && message.invoice?.id === invoiceA.id && message.body?.includes("Thanks, Aarav Mehta.")), "The phone simulator feed is missing the persisted thank-you message.");
  const paidInvoice = await prisma.invoice.findUniqueOrThrow({ where: { id: invoiceA.id }, select: { status: true } });
  assert(paidInvoice.status === "PAID", "Payment webhook did not mark invoice A paid.");
  console.log("PASS: payment webhook marks A paid; replaying the same event sends one thank-you.");

  const paidFutureRows = await prisma.reminderSchedule.findMany({
    where: { invoiceId: invoiceA.id, kind: { not: "INITIAL_DISPATCH" } },
  });
  assert(paidFutureRows.every((row) => row.state === "CANCELLED"), "Paid invoice A still has future reminders scheduled.");
  const paidJobs = await Promise.all(REMINDER_KINDS.map((kind) => getReminderQueue().getJob(jobIdFor(invoiceA.id, kind))));
  assert(paidJobs.slice(1).every((job) => !job), "Paid invoice A still has a future BullMQ job.");

  const claim = await postJson(`/api/demo/claim/${encodeURIComponent(invoiceB.id)}`);
  assert(claim.ok, `Claim simulation failed: ${await claim.text()}`);
  let claimed = await prisma.invoice.findUniqueOrThrow({ where: { id: invoiceB.id }, select: { status: true } });
  assert(claimed.status === "PENDING_VERIFICATION", "Meta claim did not set PENDING_VERIFICATION.");

  const reject = await postJson(`/api/invoices/${encodeURIComponent(invoiceB.id)}/action`, { action: "reject-claim" });
  assert(reject.ok, `Reject claim failed: ${await reject.text()}`);
  const reClaim = await postJson(`/api/demo/claim/${encodeURIComponent(invoiceB.id)}`);
  assert(reClaim.ok, `Second claim simulation failed: ${await reClaim.text()}`);
  claimed = await prisma.invoice.findUniqueOrThrow({ where: { id: invoiceB.id }, select: { status: true } });
  assert(claimed.status === "PENDING_VERIFICATION", "Invoice B could not resume and re-enter claim verification.");
  const conversationResponse = await fetch(`${baseUrl}/api/clients/${encodeURIComponent(invoiceB.clientId)}/messages`);
  assert(conversationResponse.ok, "Could not fetch the simulated client conversation.");
  const conversation = await conversationResponse.json() as { messages: { body: string | null }[]; usedInvoiceIds: string[] };
  assert(conversation.usedInvoiceIds.includes(invoiceB.id), "The conversation did not mark the quick-reply button as used.");
  assert(conversation.messages.some((message) => message.body?.includes(`Invoice ${invoiceB.invoiceNumber}`)), "The conversation is missing the rendered invoice message.");
  const claimedRows = await prisma.reminderSchedule.findMany({ where: { invoiceId: invoiceB.id } });
  assert(claimedRows.filter((row) => row.kind !== "INITIAL_DISPATCH").every((row) => row.state === "CANCELLED"), "Claimed invoice B still has active reminder rows.");
  console.log("PASS: claim pauses B; rejecting and repeating a claim pauses its resumed reminders.");

  await waitFor(async () => {
    const count = await prisma.reminderSchedule.count({
      where: {
        invoiceId: invoiceC.id,
        kind: { not: "INITIAL_DISPATCH" },
        state: "SENT",
      },
    });
    return count === 3;
  }, "all three compressed reminders for untouched invoice C", 80_000);
  const sentReminderBodies = await prisma.messageLog.findMany({
    where: { invoiceId: invoiceC.id, direction: "OUTBOUND", kind: { not: "THANKS" } },
    select: { body: true },
  });
  assert(sentReminderBodies.length === 4 && sentReminderBodies.every((log) => Boolean(log.body?.includes(`Invoice ${invoiceC.invoiceNumber}`) && log.body.includes("Pay securely:"))), "One or more invoice/reminder templates were not stored as rendered message bodies.");
  const finalA = await prisma.reminderSchedule.findMany({
    where: { invoiceId: invoiceA.id, kind: { not: "INITIAL_DISPATCH" } },
    select: { state: true },
  });
  assert(finalA.every((row) => row.state === "CANCELLED"), "A received a reminder after payment.");
  console.log("PASS: untouched invoice C received all three reminders; paid invoice A received none after payment.");

  console.log("DEMO E2E PASSED.");
  await cleanE2eBatches();
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await getReminderQueue().close();
    await getRedisConnection().quit();
    await prisma.$disconnect();
  });
