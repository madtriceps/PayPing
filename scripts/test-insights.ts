import assert from "node:assert/strict";
import { buildClientInsight, daysLate, getAgingBuckets } from "../src/lib/insights";

const today = new Date("2026-10-18T00:00:00.000Z");
const basicInvoices = [
  { id: "a", invoiceNumber: "A", amountPaise: 100, dueDate: "2026-10-01", status: "PAID", paidAt: "2026-10-01T12:00:00.000Z" },
  { id: "b", invoiceNumber: "B", amountPaise: 200, dueDate: "2026-10-03", status: "PAID", paidAt: "2026-10-01T12:00:00.000Z" },
];
const shortHistory = buildClientInsight({ id: "client", name: "Client" }, basicInvoices, today);
assert.equal(shortHistory.paidCount, 2);
assert.equal(shortHistory.reliability, "Not enough history");
assert.equal(shortHistory.avgDaysLate, -1);
assert.equal(shortHistory.onTimeRate, 1);
assert.equal(daysLate("2026-10-01", "2026-10-01T23:59:59.000Z"), 0);

const exactlyOnTimeRate = buildClientInsight(
  { id: "client", name: "Client" },
  [
    ...basicInvoices,
    { id: "c", invoiceNumber: "C", amountPaise: 100, dueDate: "2026-10-01", status: "PAID", paidAt: "2026-10-01T00:00:00.000Z" },
    { id: "d", invoiceNumber: "D", amountPaise: 100, dueDate: "2026-10-01", status: "PAID", paidAt: "2026-10-02T00:00:00.000Z" },
  ],
  today,
);
assert.equal(exactlyOnTimeRate.onTimeRate, 0.75);
assert.equal(exactlyOnTimeRate.reliability, "Sometimes late");

const buckets = getAgingBuckets([
  { id: "1", invoiceNumber: "1", amountPaise: 100, dueDate: "2026-10-18", status: "PENDING", paidAt: null },
  { id: "2", invoiceNumber: "2", amountPaise: 200, dueDate: "2026-10-11", status: "REMINDER_ACTIVE", paidAt: null },
  { id: "3", invoiceNumber: "3", amountPaise: 300, dueDate: "2026-09-18", status: "PENDING_VERIFICATION", paidAt: null },
], today);
assert.deepEqual(buckets.map(({ amountPaise, invoiceCount }) => [amountPaise, invoiceCount]), [[100, 1], [200, 1], [300, 1], [0, 0]]);

console.log("PASS: insight thresholds, early/on-time payments, and aging buckets.");
