export type InsightInvoice = {
  id: string;
  invoiceNumber: string;
  amountPaise: number;
  dueDate: Date | string;
  status: string;
  paidAt: Date | string | null;
};

export type ClientInsight = {
  clientId: string;
  name: string;
  invoices: InsightInvoice[];
  outstandingPaise: number;
  openInvoiceCount: number;
  maxDaysOverdue: number;
  paidCount: number;
  avgDaysLate: number | null;
  onTimeRate: number | null;
  lastPaidAt: string | null;
  reliability: "Usually on time" | "Sometimes late" | "Often late" | "Not enough history";
};

const DAY_MS = 24 * 60 * 60 * 1000;
const OPEN_STATUSES = new Set(["PENDING", "REMINDER_ACTIVE", "PENDING_VERIFICATION"]);

function utcDay(value: Date | string) {
  const date = new Date(value);
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

export function daysLate(dueDate: Date | string, paidAt: Date | string) {
  return Math.round((utcDay(paidAt) - utcDay(dueDate)) / DAY_MS);
}

export function buildClientInsight(
  client: { id: string; name: string },
  invoices: InsightInvoice[],
  today = new Date(),
): ClientInsight {
  const todayUtc = utcDay(today);
  const open = invoices.filter((invoice) => OPEN_STATUSES.has(invoice.status));
  const paid = invoices.filter((invoice) => invoice.status === "PAID" && invoice.paidAt);
  const lateDays = paid.map((invoice) => daysLate(invoice.dueDate, invoice.paidAt!));
  const onTimeCount = lateDays.filter((days) => days <= 0).length;
  const onTimeRate = paid.length ? onTimeCount / paid.length : null;
  const reliability = paid.length < 3
    ? "Not enough history"
    : onTimeRate! >= 0.8
      ? "Usually on time"
      : onTimeRate! >= 0.5
        ? "Sometimes late"
        : "Often late";

  return {
    clientId: client.id,
    name: client.name,
    invoices,
    outstandingPaise: open.reduce((sum, invoice) => sum + invoice.amountPaise, 0),
    openInvoiceCount: open.length,
    maxDaysOverdue: open.reduce((max, invoice) =>
      Math.max(max, Math.max(0, Math.floor((todayUtc - utcDay(invoice.dueDate)) / DAY_MS))),
    0),
    paidCount: paid.length,
    avgDaysLate: lateDays.length ? lateDays.reduce((sum, days) => sum + days, 0) / lateDays.length : null,
    onTimeRate,
    lastPaidAt: paid.reduce<string | null>((latest, invoice) => {
      const paidAt = new Date(invoice.paidAt!).toISOString();
      return !latest || paidAt > latest ? paidAt : latest;
    }, null),
    reliability,
  };
}

export function buildClientInsights(
  clients: Array<{ id: string; name: string; invoices: InsightInvoice[] }>,
  today = new Date(),
) {
  return clients.map(({ id, name, invoices }) => buildClientInsight({ id, name }, invoices, today));
}

export function getAgingBuckets(
  invoices: InsightInvoice[],
  today = new Date(),
) {
  const todayUtc = utcDay(today);
  const buckets = [
    { key: "notDue", label: "Not due", amountPaise: 0, invoiceCount: 0 },
    { key: "days1to7", label: "1–7 days", amountPaise: 0, invoiceCount: 0 },
    { key: "days8to30", label: "8–30 days", amountPaise: 0, invoiceCount: 0 },
    { key: "days31plus", label: "30+ days", amountPaise: 0, invoiceCount: 0 },
  ];
  for (const invoice of invoices) {
    if (!OPEN_STATUSES.has(invoice.status)) continue;
    const daysOverdue = Math.floor((todayUtc - utcDay(invoice.dueDate)) / DAY_MS);
    const bucket = daysOverdue <= 0 ? buckets[0]
      : daysOverdue <= 7 ? buckets[1]
        : daysOverdue <= 30 ? buckets[2] : buckets[3];
    bucket.amountPaise += invoice.amountPaise;
    bucket.invoiceCount++;
  }
  return buckets;
}
