import "dotenv/config";
import assert from "node:assert/strict";
import { prisma } from "../src/lib/prisma";
import { buildClientInsights, getAgingBuckets } from "../src/lib/insights";

const organizationId = "payping-demo-org";

async function main() {
  const clients = await prisma.client.findMany({
    where: { organizationId, phoneE164: { gte: "+919876543220", lte: "+919876543227" } },
    include: {
      invoices: {
        select: { id: true, invoiceNumber: true, amountPaise: true, dueDate: true, status: true, paidAt: true },
      },
    },
  });
  assert.equal(clients.length, 8, "The demo should seed eight insight clients.");
  const insights = buildClientInsights(clients.map((client) => ({ id: client.id, name: client.name, invoices: client.invoices })));
  assert(insights.every((client) => client.paidCount === 3), "Each insight client should have three historical payments.");
  assert(insights.some((client) => client.reliability === "Usually on time"));
  assert(insights.some((client) => client.reliability === "Sometimes late"));
  assert(insights.some((client) => client.reliability === "Often late"));
  assert(insights.some((client) => client.outstandingPaise > 0), "At least one insight client should have an open invoice.");
  const open = clients.flatMap((client) => client.invoices).filter((invoice) =>
    ["PENDING", "REMINDER_ACTIVE", "PENDING_VERIFICATION"].includes(invoice.status),
  );
  const buckets = getAgingBuckets(open);
  assert(buckets.reduce((sum, bucket) => sum + bucket.invoiceCount, 0) === open.length);
  assert(buckets.every((bucket) => bucket.invoiceCount > 0), "Seeded demo invoices should populate all four aging buckets.");
  console.log("PASS: eight seeded clients have varied payment histories, open invoices, and aging metrics.");
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
