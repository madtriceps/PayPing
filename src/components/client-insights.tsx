"use client";

import { useMemo, useState } from "react";
import type { ClientInsight } from "@/lib/insights";
import { PingMark } from "@/components/ping-mark";

type SortKey = "outstandingPaise" | "avgDaysLate" | "onTimeRate" | "lastPaidAt";
type FilterKey = "overdue" | "verification" | "history";

const money = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });
const percent = new Intl.NumberFormat("en-IN", { style: "percent", maximumFractionDigits: 0 });

function formatDate(value: Date | string | null) {
  return value
    ? new Date(value).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
    : "No payments yet";
}

export function ClientInsights({ clients, initialClientId = "" }: { clients: ClientInsight[]; initialClientId?: string }) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("outstandingPaise");
  const [filters, setFilters] = useState<FilterKey[]>([]);
  const [selectedId, setSelectedId] = useState(initialClientId);
  const selected = clients.find((client) => client.clientId === selectedId) ?? null;
  const filtered = useMemo(() => clients
    .filter((client) => client.name.toLowerCase().includes(query.trim().toLowerCase()))
    .filter((client) => !filters.includes("overdue") || client.maxDaysOverdue > 0)
    .filter((client) => !filters.includes("verification") || client.invoices.some((invoice) => invoice.status === "PENDING_VERIFICATION"))
    .filter((client) => !filters.includes("history") || client.paidCount < 3)
    .sort((a, b) => {
      const aValue = a[sort];
      const bValue = b[sort];
      if (aValue === null) return 1;
      if (bValue === null) return -1;
      if (sort === "lastPaidAt") return String(bValue).localeCompare(String(aValue));
      return Number(bValue) - Number(aValue);
    }), [clients, filters, query, sort]);

  function toggleFilter(filter: FilterKey) {
    setFilters((current) => current.includes(filter) ? current.filter((item) => item !== filter) : [...current, filter]);
  }

  return (
    <div className="clients-layout">
      <section className="clients-list">
        <div className="clients-controls">
          <label>Search clients<input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Find a client" /></label>
          <label>Sort by<select value={sort} onChange={(event) => setSort(event.target.value as SortKey)}>
            <option value="outstandingPaise">Outstanding</option>
            <option value="avgDaysLate">Average days late</option>
            <option value="onTimeRate">On-time rate</option>
            <option value="lastPaidAt">Last payment date</option>
          </select></label>
        </div>
        <div className="client-filter-chips" aria-label="Client filters">
          {([
            ["overdue", "Overdue"],
            ["verification", "Has pending verification"],
            ["history", "Not enough history"],
          ] as [FilterKey, string][]).map(([key, label]) => (
            <button type="button" key={key} aria-pressed={filters.includes(key)} onClick={() => toggleFilter(key)}>{label}</button>
          ))}
        </div>
        <div className="clients-table-wrap">
          <table className="clients-table">
            <thead><tr><th>Client</th><th>Outstanding</th><th>Avg days late</th><th>On-time rate</th><th>Last payment</th></tr></thead>
            <tbody>
              {filtered.map((client) => (
                <tr key={client.clientId} className={selectedId === client.clientId ? "client-row--selected" : ""}>
                  <td><button type="button" onClick={() => setSelectedId(client.clientId)}>{client.name}</button><small>Based on {client.paidCount} invoices</small></td>
                  <td>{money.format(client.outstandingPaise / 100)}</td>
                  <td>{client.avgDaysLate === null ? "—" : `${Math.round(client.avgDaysLate)} days`}</td>
                  <td>{client.onTimeRate === null ? "—" : percent.format(client.onTimeRate)}</td>
                  <td>{formatDate(client.lastPaidAt)}</td>
                </tr>
              ))}
              {!filtered.length && <tr><td colSpan={5} className="clients-empty">No clients match those filters.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
      <aside className="client-detail" aria-live="polite">
        {!selected ? <p>Choose a client to see their payment history.</p> : (
          <>
            <p className="site-eyebrow">Client overview</p>
            <h2>{selected.name}</h2>
            <p>{selected.reliability} · Based on {selected.paidCount} invoices</p>
            <dl>
              <div><dt>Outstanding</dt><dd>{money.format(selected.outstandingPaise / 100)}</dd></div>
              <div><dt>Average days late</dt><dd>{selected.avgDaysLate === null ? "Not enough history" : `${Math.round(selected.avgDaysLate)} days`}</dd></div>
              <div><dt>On-time rate</dt><dd>{selected.onTimeRate === null ? "Not enough history" : percent.format(selected.onTimeRate)}</dd></div>
            </dl>
            <h3>Invoice history</h3>
            <ol className="client-payment-timeline">
              {selected.invoices.map((invoice) => (
                <li key={invoice.id}>
                  <PingMark state={invoice.status === "PAID" ? "paid" : ["PENDING_VERIFICATION", "FAILED", "CANCELLED"].includes(invoice.status) ? "paused" : "waiting"} />
                  <div><strong>{invoice.invoiceNumber}</strong><span>{invoice.status === "PAID" && invoice.paidAt ? `Paid ${formatDate(invoice.paidAt)}` : `${invoice.status.replaceAll("_", " ").toLowerCase()} · due ${formatDate(invoice.dueDate)}`}</span></div>
                  <b>{money.format(invoice.amountPaise / 100)}</b>
                </li>
              ))}
            </ol>
          </>
        )}
      </aside>
    </div>
  );
}
