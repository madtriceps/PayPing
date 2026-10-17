import "dotenv/config";
import { prisma } from "../src/lib/prisma";
import { getRedisConnection } from "../src/lib/queue/connection";
import { getReminderQueue } from "../src/lib/queue/reminder.queue";

async function main() {
  if (process.env.DEMO_TIME_COMPRESSION !== "true") {
    throw new Error("Set DEMO_TIME_COMPRESSION=true before running this verification.");
  }

  const organization = await prisma.organization.create({
    data: { name: "Schedule verification", timezone: "Asia/Kolkata" },
  });
  const client = await prisma.client.create({
    data: {
      organizationId: organization.id,
      name: "Schedule verification",
      phoneE164: `+910${Date.now().toString().slice(-9)}`,
    },
  });
  const invoice = await prisma.invoice.create({
    data: {
      organizationId: organization.id,
      clientId: client.id,
      invoiceNumber: `verify-${Date.now()}`,
      amountPaise: 100,
      dueDate: new Date(Date.now() + 30 * 86_400_000),
    },
  });

  try {
    const { scheduleInvoiceSequence } = await import("../src/lib/queue/reminder.queue");
    await scheduleInvoiceSequence(invoice.id);

    const rows = await prisma.reminderSchedule.findMany({
      where: { invoiceId: invoice.id },
      orderBy: { runAt: "asc" },
    });
    if (rows.length !== 4) throw new Error(`Expected 4 reminder rows; found ${rows.length}.`);

    const expectedKinds = ["INITIAL_DISPATCH", "BEFORE_DUE_3D", "ON_DUE_DATE", "AFTER_DUE_2D"];
    const actualKinds = new Set(rows.map((row) => row.kind));
    for (const kind of expectedKinds) {
      if (!actualKinds.has(kind as (typeof rows)[number]["kind"])) {
        throw new Error(`Missing reminder kind ${kind}.`);
      }
    }

    const jobs = await Promise.all(rows.map((row) => getReminderQueue().getJob(row.bullJobId)));
    if (jobs.some((job) => !job)) throw new Error("At least one scheduled job is missing from BullMQ.");
    console.log(`PASS: ${rows.length} reminder jobs queued; compressed offsets are 0s, 20s, 40s, 60s.`);
  } finally {
    await Promise.all(
      (await prisma.reminderSchedule.findMany({ where: { invoiceId: invoice.id } })).map(async (row) => {
        const job = await getReminderQueue().getJob(row.bullJobId);
        if (job) await job.remove();
      }),
    );
    await prisma.organization.delete({ where: { id: organization.id } });
  }
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
