import "dotenv/config";
import { InvoiceStatus } from "@prisma/client";
import { prisma } from "../src/lib/prisma";
import { cancelInvoiceReminders, getReminderQueue, scheduleInvoiceSequence } from "../src/lib/queue/reminder.queue";
import { getRedisConnection } from "../src/lib/queue/connection";

const DEMO_ORG_ID = "payping-demo-org";
// LATER: replace with real auth.
const demoClients = [
  { name: "Aarav Mehta", phoneE164: "+919876543210", invoiceNumber: "DEMO-1001", amountPaise: 1250000, dueInDays: 1 },
  { name: "Diya Shah", phoneE164: "+919876543211", invoiceNumber: "DEMO-1002", amountPaise: 875050, dueInDays: 3 },
  { name: "Kabir Rao", phoneE164: "+919876543212", invoiceNumber: "DEMO-1003", amountPaise: 2400000, dueInDays: 5 },
  { name: "Meera Iyer", phoneE164: "+919876543213", invoiceNumber: "DEMO-1004", amountPaise: 460000, dueInDays: -1 },
  { name: "Ishaan Patel", phoneE164: "+919876543214", invoiceNumber: "DEMO-1005", amountPaise: 1325075, dueInDays: 60 },
];

const demoPaymentHistory = [
  { name: "Anaya Desai", phoneE164: "+919876543220", delays: [-2, 0, 1] },
  { name: "Rohan Kapoor", phoneE164: "+919876543221", delays: [0, 1, 2] },
  { name: "Sana Khan", phoneE164: "+919876543222", delays: [0, 0, 7] },
  { name: "Dev Malhotra", phoneE164: "+919876543223", delays: [2, 4, 8] },
  { name: "Ira Nair", phoneE164: "+919876543224", delays: [-3, -1, 0] },
  { name: "Arjun Rao", phoneE164: "+919876543225", delays: [9, 12, 16] },
  { name: "Mira Shah", phoneE164: "+919876543226", delays: [1, 0, 4] },
  { name: "Neel Joshi", phoneE164: "+919876543227", delays: [18, 22, 25] },
];

const insightOpenInvoices = [
  { historyIndex: 0, invoiceNumber: "INSIGHT-OPEN-1", amountPaise: 875_000, dueInDays: -5 },
  { historyIndex: 1, invoiceNumber: "INSIGHT-OPEN-2", amountPaise: 1_750_000, dueInDays: 3 },
  { historyIndex: 2, invoiceNumber: "INSIGHT-OPEN-3", amountPaise: 750_000, dueInDays: -18 },
  { historyIndex: 3, invoiceNumber: "INSIGHT-OPEN-4", amountPaise: 1_100_000, dueInDays: -40 },
];

async function main() {
  await prisma.organization.upsert({
    where: { id: DEMO_ORG_ID },
    create: { id: DEMO_ORG_ID, name: "Demo Distributors", timezone: "Asia/Kolkata" },
    update: { name: "Demo Distributors", timezone: "Asia/Kolkata" },
  });
  console.log(`Demo organization ready: ${DEMO_ORG_ID}`);

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  for (const entry of demoClients) {
    const client = await prisma.client.upsert({
      where: {
        organizationId_phoneE164_name: {
          organizationId: DEMO_ORG_ID,
          phoneE164: entry.phoneE164,
          name: entry.name,
        },
      },
      create: { organizationId: DEMO_ORG_ID, name: entry.name, phoneE164: entry.phoneE164 },
      update: {},
    });
    const existingInvoice = await prisma.invoice.findUnique({
      where: { organizationId_invoiceNumber: { organizationId: DEMO_ORG_ID, invoiceNumber: entry.invoiceNumber } },
      select: { id: true },
    });
    if (existingInvoice) {
      await cancelInvoiceReminders(existingInvoice.id, "CANCELLED");
      await prisma.messageLog.deleteMany({ where: { invoiceId: existingInvoice.id } });
      await prisma.reminderSchedule.deleteMany({ where: { invoiceId: existingInvoice.id } });
    }
    const dueDate = new Date(today.getTime() + entry.dueInDays * 24 * 60 * 60 * 1000);
    const invoice = await prisma.invoice.upsert({
      where: {
        organizationId_invoiceNumber: {
          organizationId: DEMO_ORG_ID,
          invoiceNumber: entry.invoiceNumber,
        },
      },
      create: {
        organizationId: DEMO_ORG_ID,
        clientId: client.id,
        invoiceNumber: entry.invoiceNumber,
        amountPaise: entry.amountPaise,
        dueDate,
        status: InvoiceStatus.PENDING,
      },
      update: {
        clientId: client.id,
        amountPaise: entry.amountPaise,
        dueDate,
        status: InvoiceStatus.PENDING,
        paidAt: null,
        paidAmountPaise: null,
        paidSource: null,
        rzpPaymentId: null,
        claimedPaidAt: null,
        lastFailureReason: null,
      },
    });
    await scheduleInvoiceSequence(invoice.id);
  }

  // Demo history gives the read-only collections insights a varied, repeatable sample.
  for (const [clientIndex, entry] of demoPaymentHistory.entries()) {
    const client = await prisma.client.upsert({
      where: {
        organizationId_phoneE164_name: {
          organizationId: DEMO_ORG_ID,
          phoneE164: entry.phoneE164,
          name: entry.name,
        },
      },
      create: { organizationId: DEMO_ORG_ID, name: entry.name, phoneE164: entry.phoneE164 },
      update: {},
    });

    for (const [paymentIndex, delay] of entry.delays.entries()) {
      const dueDate = new Date(today.getTime() - (120 - paymentIndex * 30) * 86_400_000);
      const paidAt = new Date(dueDate.getTime() + delay * 86_400_000);
      await prisma.invoice.upsert({
        where: {
          organizationId_invoiceNumber: {
            organizationId: DEMO_ORG_ID,
            invoiceNumber: `HISTORY-${clientIndex + 1}-${paymentIndex + 1}`,
          },
        },
        create: {
          organizationId: DEMO_ORG_ID,
          clientId: client.id,
          invoiceNumber: `HISTORY-${clientIndex + 1}-${paymentIndex + 1}`,
          amountPaise: (clientIndex + 2) * (paymentIndex + 1) * 125_000,
          dueDate,
          paidAt,
          paidAmountPaise: (clientIndex + 2) * (paymentIndex + 1) * 125_000,
          paidSource: "MANUAL_OWNER",
          status: InvoiceStatus.PAID,
        },
        update: {
          dueDate,
          paidAt,
          paidAmountPaise: (clientIndex + 2) * (paymentIndex + 1) * 125_000,
          paidSource: "MANUAL_OWNER",
          status: InvoiceStatus.PAID,
        },
      });
    }
  }

  for (const entry of insightOpenInvoices) {
    const clientEntry = demoPaymentHistory[entry.historyIndex];
    const client = await prisma.client.findUniqueOrThrow({
      where: {
        organizationId_phoneE164_name: {
          organizationId: DEMO_ORG_ID,
          phoneE164: clientEntry.phoneE164,
          name: clientEntry.name,
        },
      },
    });
    const existingInvoice = await prisma.invoice.findUnique({
      where: {
        organizationId_invoiceNumber: {
          organizationId: DEMO_ORG_ID,
          invoiceNumber: entry.invoiceNumber,
        },
      },
      select: { id: true },
    });
    if (existingInvoice) {
      await cancelInvoiceReminders(existingInvoice.id, "CANCELLED");
      await prisma.messageLog.deleteMany({ where: { invoiceId: existingInvoice.id } });
      await prisma.reminderSchedule.deleteMany({ where: { invoiceId: existingInvoice.id } });
    }
    const invoice = await prisma.invoice.upsert({
      where: {
        organizationId_invoiceNumber: {
          organizationId: DEMO_ORG_ID,
          invoiceNumber: entry.invoiceNumber,
        },
      },
      create: {
        organizationId: DEMO_ORG_ID,
        clientId: client.id,
        invoiceNumber: entry.invoiceNumber,
        amountPaise: entry.amountPaise,
        dueDate: new Date(today.getTime() + entry.dueInDays * 86_400_000),
        status: InvoiceStatus.PENDING,
      },
      update: {
        clientId: client.id,
        amountPaise: entry.amountPaise,
        dueDate: new Date(today.getTime() + entry.dueInDays * 86_400_000),
        status: InvoiceStatus.PENDING,
        paidAt: null,
        paidAmountPaise: null,
        paidSource: null,
        rzpPaymentId: null,
        claimedPaidAt: null,
        lastFailureReason: null,
      },
    });
    await scheduleInvoiceSequence(invoice.id);
  }
  console.log(`Demo invoices ready: ${demoClients.length} dashboard + ${demoPaymentHistory.length * 3} history + ${insightOpenInvoices.length} open insight invoices`);
}

main()
  .catch((error) => {
    console.error("Failed to seed demo organization:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await getReminderQueue().close();
    await getRedisConnection().quit();
    await prisma.$disconnect();
  });
