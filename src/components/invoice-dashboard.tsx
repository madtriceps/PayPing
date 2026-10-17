"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ClientInsight } from "@/lib/insights";
import { UtilityIcon as Icon } from "@/components/icons";
import { PingMark } from "@/components/ping-mark";

type InvoiceStatus =
  | "PENDING"
  | "REMINDER_ACTIVE"
  | "PENDING_VERIFICATION"
  | "PAID"
  | "FAILED"
  | "CANCELLED";

type MessageRecord = {
  id: string;
  direction: "OUTBOUND" | "INBOUND";
  kind: string;
  body: string | null;
  status: string;
  createdAt: string;
};

type ReminderRecord = {
  kind: string;
  state: string;
  runAt: string;
  firedAt: string | null;
};

type InvoiceRow = {
  id: string;
  invoiceNumber: string;
  amountPaise: number;
  dueDate: string;
  createdAt: string;
  paidAt: string | null;
  paidAmountPaise: number | null;
  status: InvoiceStatus;
  client: { id: string; name: string; phoneE164: string };
  nextReminder: { runAt: string; kind: string } | null;
  reminders: ReminderRecord[];
  messages: MessageRecord[];
};

type InvoiceTab = "all" | "approval" | "active" | "overdue" | "paid" | "failed";
type InvoiceSort = "dueDate" | "amount" | "client";

const tabLabels: Record<InvoiceTab, string> = {
  all: "All",
  approval: "Needs your approval",
  active: "Active",
  overdue: "Overdue",
  paid: "Paid",
  failed: "Failed",
};

function belongsToTab(invoice: InvoiceRow, tab: InvoiceTab) {
  if (tab === "approval") return invoice.status === "PENDING_VERIFICATION";
  if (tab === "active") return invoice.status === "PENDING" || invoice.status === "REMINDER_ACTIVE";
  if (tab === "overdue") return !["PAID", "CANCELLED"].includes(invoice.status) && new Date(invoice.dueDate).getTime() < Date.now();
  if (tab === "paid") return invoice.status === "PAID";
  if (tab === "failed") return invoice.status === "FAILED";
  return true;
}

type SimulatorMessage = {
  id: string;
  kind: string;
  body: string | null;
  createdAt: string;
  invoice: {
    id: string;
    invoiceNumber: string;
    amountPaise: number;
    dueDate: string;
    rzpShortUrl: string | null;
    status: InvoiceStatus;
    client: { name: string };
  } | null;
};

const money = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});
const moneyWithPaise = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const statusLabels: Record<InvoiceStatus, string> = {
  PENDING: "Pending",
  REMINDER_ACTIVE: "Following up",
  PENDING_VERIFICATION: "Checking payment",
  PAID: "Paid",
  FAILED: "Needs attention",
  CANCELLED: "Cancelled",
};

function pingState(status: InvoiceStatus): "waiting" | "paid" | "paused" {
  if (status === "PAID") return "paid";
  if (status === "PENDING_VERIFICATION" || status === "FAILED" || status === "CANCELLED") return "paused";
  return "waiting";
}

function AnimatedAmount({ value }: { value: number }) {
  const [shown, setShown] = useState(0);
  const currentValue = useRef(0);
  useEffect(() => {
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reducedMotion || document.visibilityState === "hidden") {
      currentValue.current = value;
      setShown(value);
      return;
    }
    let frame = 0;
    const finishWhenHidden = () => {
      if (document.visibilityState !== "hidden") return;
      currentValue.current = value;
      setShown(value);
    };
    document.addEventListener("visibilitychange", finishWhenHidden);
    const start = performance.now();
    const from = currentValue.current;
    const duration = 240;
    const animate = (now: number) => {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const next = from + (value - from) * eased;
      currentValue.current = next;
      setShown(next);
      if (progress < 1) frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("visibilitychange", finishWhenHidden);
    };
  }, [value]);

  return <span className="tabular-nums">{money.format(shown / 100)}</span>;
}

function AnimatedCount({ value }: { value: number }) {
  const [shown, setShown] = useState(0);
  const currentValue = useRef(0);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || document.visibilityState === "hidden") {
      currentValue.current = value;
      setShown(value);
      return;
    }
    const from = currentValue.current;
    const start = performance.now();
    let frame = 0;
    const finishWhenHidden = () => {
      if (document.visibilityState !== "hidden") return;
      currentValue.current = value;
      setShown(value);
    };
    document.addEventListener("visibilitychange", finishWhenHidden);
    const animate = (now: number) => {
      const progress = Math.min((now - start) / 240, 1);
      const next = Math.round(from + (value - from) * (1 - Math.pow(1 - progress, 3)));
      currentValue.current = next;
      setShown(next);
      if (progress < 1) frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("visibilitychange", finishWhenHidden);
    };
  }, [value]);
  return <span className="tabular-nums">{shown}</span>;
}

function formatAmount(paise: number) {
  return (paise % 100 === 0 ? money : moneyWithPaise).format(paise / 100);
}

function relativeDueDate(isoDate: string) {
  const due = new Date(isoDate);
  const today = new Date();
  const todayUtc = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  const dueUtc = Date.UTC(due.getUTCFullYear(), due.getUTCMonth(), due.getUTCDate());
  const days = Math.round((dueUtc - todayUtc) / 86_400_000);
  if (days === 0) return "Due today";
  if (days === 1) return "In 1 day";
  if (days > 1) return `In ${days} days`;
  if (days === -1) return "1 day overdue";
  return `${Math.abs(days)} days overdue`;
}

function exactDate(isoDate: string) {
  return new Date(isoDate).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

function readableKind(kind: string) {
  return kind.replaceAll("_", " ").toLowerCase().replace(/(^|\s)\S/g, (letter) => letter.toUpperCase());
}

function formatTime(isoDate: string) {
  return new Date(isoDate).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });
}

function phoneMessageBody(message: SimulatorMessage) {
  if (message.body) return message.body;
  const invoice = message.invoice;
  if (!invoice) return "A message was sent.";
  if (message.kind === "THANKS") {
    return `Thanks, ${invoice.client.name}. We’ve received ${formatAmount(invoice.amountPaise)} for invoice ${invoice.invoiceNumber}.`;
  }
  return [
    `Hi ${invoice.client.name},`,
    `Invoice ${invoice.invoiceNumber}`,
    `Amount: ${formatAmount(invoice.amountPaise)}`,
    `Due date: ${exactDate(invoice.dueDate)}`,
    `Pay securely: ${invoice.rzpShortUrl ?? `${window.location.origin}/pay/${invoice.id}`}`,
  ].join("\n");
}

function PhoneSimulator({
  clients,
  selectedClientId,
  onSelectClient,
  messages,
  usedInvoiceIds,
  onClaim,
  busyClaimId,
  mobile = false,
  onClose,
}: {
  clients: InvoiceRow["client"][];
  selectedClientId: string;
  onSelectClient: (clientId: string) => void;
  messages: SimulatorMessage[];
  usedInvoiceIds: string[];
  onClaim: (invoiceId: string) => void;
  busyClaimId: string | null;
  mobile?: boolean;
  onClose?: () => void;
}) {
  const selectedClient = clients.find((client) => client.id === selectedClientId);
  const usedSet = new Set(usedInvoiceIds);
  const streamRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const stream = streamRef.current;
    if (!stream) return;
    const behavior = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
    stream.scrollTo({ top: stream.scrollHeight, behavior });
  }, [messages.length]);

  return (
    <aside className={`phone-panel${mobile ? " phone-panel--mobile" : ""}`} aria-label="Simulated WhatsApp">
      <div className="phone-panel-heading">
        <div>
          <p className="eyebrow-muted">Preview of client's phone</p>
          <h2>Client conversation</h2>
        </div>
        {onClose && <button className="icon-button phone-close" aria-label="Close phone simulator" onClick={onClose}><Icon name="close" /></button>}
      </div>

      <label className="client-select-label" htmlFor="simulator-client">Conversation with</label>
      <select
        className="client-select"
        id="simulator-client"
        value={selectedClientId}
        onChange={(event) => onSelectClient(event.target.value)}
        disabled={!clients.length}
      >
        {!clients.length && <option value="">Upload invoices to begin</option>}
        {clients.map((client) => (
          <option key={client.id} value={client.id}>{client.name}</option>
        ))}
      </select>

      <div className="device-frame">
        <div className="device-screen">
          <div className="chat-topbar">
            <div className="avatar-mark">{selectedClient?.name.slice(0, 1).toUpperCase() ?? "—"}</div>
            <div className="chat-contact">
              <strong>{selectedClient?.name ?? "Choose a client"}</strong>
              <span>{selectedClient ? "Invoice reminders" : "Your conversations appear here"}</span>
            </div>
            <span className="chat-live-dot" title="Updates every two seconds" />
          </div>
          <div className="chat-stream" aria-live="polite" ref={streamRef}>
            {!selectedClient ? (
              <div className="chat-empty">
                <span className="chat-empty-icon"><Icon name="phone" size={21} /></span>
                <p>Choose a client to see their invoice messages.</p>
              </div>
            ) : !messages.length ? (
              <div className="chat-empty">
                <span className="chat-empty-icon"><Icon name="spark" size={21} /></span>
                <p>Nothing to chase today.</p>
                <span>Their messages will appear here as reminders are sent.</span>
              </div>
            ) : messages.map((message) => {
              const invoice = message.invoice;
              const body = phoneMessageBody(message);
              const lines = body.split("\n");
              const isThanks = message.kind === "THANKS";
              const alreadyUsed = invoice ? usedSet.has(invoice.id) || invoice.status === "PAID" : false;
              return (
                <article className="chat-message" key={message.id}>
                  <div className="chat-bubble" key={`${message.id}-${body}`}>
                    {lines.map((line, index) => {
                      const paymentLine = line.startsWith("Pay securely: ");
                      if (paymentLine && invoice) {
                        return (
                          <p className="chat-line" key={`${message.id}-${index}`}>
                            <span>Pay securely: </span>
                            <a href={`/pay/${encodeURIComponent(invoice.id)}`} target="_blank" rel="noreferrer">
                              {line.slice("Pay securely: ".length)}
                              <Icon name="arrow" size={13} />
                            </a>
                          </p>
                        );
                      }
                      return <p className="chat-line" key={`${message.id}-${index}`}>{line}</p>;
                    })}
                    {!isThanks && invoice && (
                      <button
                        className={`quick-reply${alreadyUsed ? " quick-reply--used" : ""}`}
                        disabled={alreadyUsed || busyClaimId === invoice.id}
                        onClick={() => onClaim(invoice.id)}
                      >
                        {alreadyUsed
                          ? <><Icon name="check" size={14} />{invoice?.status === "PAID" ? "Invoice paid · reminders stopped" : "Button used · reminders paused"}</>
                          : busyClaimId === invoice?.id ? "Sending reply…" : "Already Paid? Tap to Pause"}
                      </button>
                    )}
                    <div className="bubble-meta">
                      <span>{readableKind(message.kind)}</span>
                      <time dateTime={message.createdAt}>{formatTime(message.createdAt)}</time>
                      <Icon name="check" size={13} />
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
          <div className="chat-composer"><span>Demo conversation</span><span className="composer-lock"><Icon name="check" size={14} /> Read only</span></div>
        </div>
      </div>
      <p className="phone-footnote">Messages are simulated. No WhatsApp message is sent.</p>
    </aside>
  );
}

function CollectionsOverview({ clients, invoices }: { clients: ClientInsight[]; invoices: InvoiceRow[] }) {
  const overdueInvoiceRows = invoices
    .filter((invoice) =>
      !["PAID", "CANCELLED"].includes(invoice.status) &&
      new Date(invoice.dueDate).getTime() < new Date().setHours(0, 0, 0, 0),
    )
    .sort((a, b) => {
      const daysA = Math.floor((Date.now() - new Date(a.dueDate).getTime()) / 86_400_000);
      const daysB = Math.floor((Date.now() - new Date(b.dueDate).getTime()) / 86_400_000);
      return b.amountPaise * daysB - a.amountPaise * daysA;
    });
  const lists = [
    {
      title: "Needs attention today",
      rows: overdueInvoiceRows.slice(0, 5).map((invoice) => ({
        href: `/demo/clients?clientId=${encodeURIComponent(invoice.client.id)}`,
        name: invoice.client.name,
        detail: `${invoice.invoiceNumber} · ${relativeDueDate(invoice.dueDate)}`,
        amount: formatAmount(invoice.amountPaise),
      })),
      empty: "Nothing to chase today.",
    },
    {
      title: "Biggest outstanding",
      rows: [...clients].filter((client) => client.outstandingPaise > 0).sort((a, b) => b.outstandingPaise - a.outstandingPaise).slice(0, 5).map((client) => ({
        href: `/demo/clients?clientId=${encodeURIComponent(client.clientId)}`,
        name: client.name,
        detail: `${client.openInvoiceCount} open invoices`,
        amount: formatAmount(client.outstandingPaise),
      })),
      empty: "Nothing outstanding.",
    },
    {
      title: "Slowest payers",
      rows: [...clients].filter((client) => client.paidCount >= 3 && client.avgDaysLate !== null).sort((a, b) => b.avgDaysLate! - a.avgDaysLate!).slice(0, 5).map((client) => ({
        href: `/demo/clients?clientId=${encodeURIComponent(client.clientId)}`,
        name: client.name,
        detail: `Based on ${client.paidCount} invoices`,
        amount: `${Math.round(client.avgDaysLate!)} days late on average`,
      })),
      empty: "Not enough payment history yet.",
    },
    {
      title: "Most reliable",
      rows: [...clients].filter((client) => client.paidCount >= 3 && client.onTimeRate !== null).sort((a, b) => b.onTimeRate! - a.onTimeRate!).slice(0, 5).map((client) => ({
        href: `/demo/clients?clientId=${encodeURIComponent(client.clientId)}`,
        name: client.name,
        detail: `Based on ${client.paidCount} invoices`,
        amount: `${Math.round(client.onTimeRate! * 100)}% on time`,
      })),
      empty: "Not enough payment history yet.",
    },
  ];

  return (
    <section className="collections-overview" aria-label="Collections overview">
      {lists.map((list) => (
        <div className="collections-list" key={list.title}>
          <h3>{list.title}</h3>
          {list.rows.length ? list.rows.map((row) => (
            <a href={row.href} key={`${row.name}-${row.detail}`}>
              <span><strong>{row.name}</strong><small>{row.detail}</small></span>
              <b>{row.amount}</b>
            </a>
          )) : <p>{list.empty}</p>}
        </div>
      ))}
      <a className="all-clients-link" href="/demo/clients">View all client insights <span aria-hidden="true">↗</span></a>
    </section>
  );
}

function InvoiceJourney({
  invoice,
  onClose,
}: {
  invoice: InvoiceRow;
  onClose: () => void;
}) {
  const events = [
    { at: invoice.createdAt, title: "Invoice added", detail: `Added from the receivables file as ${invoice.invoiceNumber}.`, icon: "file" as const },
    ...invoice.reminders.map((reminder) => ({
      at: reminder.firedAt ?? reminder.runAt,
      title: reminder.state === "SENT" ? `${readableKind(reminder.kind)} sent` : `${readableKind(reminder.kind)} ${reminder.state.toLowerCase()}`,
      detail: reminder.state === "SCHEDULED" ? `Planned for ${new Date(reminder.runAt).toLocaleString("en-IN")}.` : "",
      icon: reminder.state === "SENT" ? "check" as const : "clock" as const,
    })),
    ...invoice.messages.filter((message) => message.kind === "THANKS").map((message) => ({
      at: message.createdAt,
      title: "Payment received",
      detail: `A thank-you was sent after ${formatAmount(invoice.paidAmountPaise ?? invoice.amountPaise)} arrived.`,
      icon: "check" as const,
    })),
  ].sort((a, b) => a.at.localeCompare(b.at));

  return (
    <div className="journey-scrim" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <section className="journey-panel" role="dialog" aria-modal="true" aria-labelledby="journey-title">
        <div className="journey-heading">
          <div>
            <p className="eyebrow-muted">Invoice journey</p>
            <h2 id="journey-title">{invoice.invoiceNumber}</h2>
            <p>{invoice.client.name} · {formatAmount(invoice.amountPaise)}</p>
          </div>
          <button className="icon-button" aria-label="Close invoice journey" onClick={onClose}><Icon name="close" /></button>
        </div>
        <div className="journey-status"><PingMark state={pingState(invoice.status)} />{statusLabels[invoice.status]}</div>
        <ol className="journey-timeline">
          {events.map((event, index) => (
            <li className="journey-event" key={`${event.title}-${event.at}-${index}`}>
              <span className="journey-icon"><Icon name={event.icon} size={16} /></span>
              <div className="journey-copy">
                <strong>{event.title}</strong>
                {event.detail && <p>{event.detail}</p>}
                <time dateTime={event.at}>{new Date(event.at).toLocaleString("en-IN")}</time>
              </div>
            </li>
          ))}
          {invoice.status === "PAID" && invoice.paidAt && (
            <li className="journey-event">
              <span className="journey-icon journey-icon--paid"><Icon name="check" size={16} /></span>
              <div className="journey-copy"><strong>Paid in full</strong><p>{formatAmount(invoice.paidAmountPaise ?? invoice.amountPaise)} received.</p><time dateTime={invoice.paidAt}>{new Date(invoice.paidAt).toLocaleString("en-IN")}</time></div>
            </li>
          )}
        </ol>
      </section>
    </div>
  );
}

export function InvoiceDashboard() {
  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
  const [clientInsights, setClientInsights] = useState<ClientInsight[]>([]);
  const [remindersSentToday, setRemindersSentToday] = useState(0);
  const [messages, setMessages] = useState<SimulatorMessage[]>([]);
  const [usedInvoiceIds, setUsedInvoiceIds] = useState<string[]>([]);
  const [selectedClientId, setSelectedClientId] = useState("");
  const [selectedInvoice, setSelectedInvoice] = useState<InvoiceRow | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [busyClaimId, setBusyClaimId] = useState<string | null>(null);
  const [phoneOpen, setPhoneOpen] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [activeTab, setActiveTab] = useState<InvoiceTab>("all");
  const [invoiceSearch, setInvoiceSearch] = useState("");
  const [invoiceSort, setInvoiceSort] = useState<InvoiceSort>("dueDate");

  const clients = useMemo(() => {
    const seen = new Set<string>();
    return invoices.flatMap((invoice) => {
      if (seen.has(invoice.client.id)) return [];
      seen.add(invoice.client.id);
      return [invoice.client];
    }).sort((a, b) => a.name.localeCompare(b.name));
  }, [invoices]);

  const outstandingPaise = invoices
    .filter((invoice) => invoice.status !== "PAID" && invoice.status !== "CANCELLED")
    .reduce((sum, invoice) => sum + invoice.amountPaise, 0);
  const collectedThisMonthPaise = invoices
    .filter((invoice) => {
      if (invoice.status !== "PAID" || !invoice.paidAt) return false;
      const paid = new Date(invoice.paidAt);
      const now = new Date();
      return paid.getFullYear() === now.getFullYear() && paid.getMonth() === now.getMonth();
    })
    .reduce((sum, invoice) => sum + (invoice.paidAmountPaise ?? invoice.amountPaise), 0);

  const invoiceCounts = useMemo(() => {
    const counts = {} as Record<InvoiceTab, number>;
    for (const tab of Object.keys(tabLabels) as InvoiceTab[]) {
      counts[tab] = invoices.filter((invoice) => belongsToTab(invoice, tab)).length;
    }
    return counts;
  }, [invoices]);
  const visibleTabs = (Object.keys(tabLabels) as InvoiceTab[]).filter((tab) => tab !== "failed" || invoiceCounts.failed > 0);
  const visibleInvoices = useMemo(() => invoices
    .filter((invoice) => belongsToTab(invoice, activeTab))
    .filter((invoice) => `${invoice.client.name} ${invoice.invoiceNumber}`.toLowerCase().includes(invoiceSearch.trim().toLowerCase()))
    .sort((a, b) => {
      if (invoiceSort === "amount") return b.amountPaise - a.amountPaise;
      if (invoiceSort === "client") return a.client.name.localeCompare(b.client.name);
      return a.dueDate.localeCompare(b.dueDate);
    }), [activeTab, invoiceSearch, invoiceSort, invoices]);

  useEffect(() => {
    const fromLocation = () => {
      const tab = new URLSearchParams(window.location.search).get("tab");
      if (tab && Object.hasOwn(tabLabels, tab)) setActiveTab(tab as InvoiceTab);
      else setActiveTab("all");
    };
    fromLocation();
    window.addEventListener("popstate", fromLocation);
    return () => window.removeEventListener("popstate", fromLocation);
  }, []);

  useEffect(() => {
    const url = new URL(window.location.href);
    if (activeTab === "all") url.searchParams.delete("tab");
    else url.searchParams.set("tab", activeTab);
    window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
  }, [activeTab]);

  const refresh = useCallback(async () => {
    const [response, insightResponse] = await Promise.all([
      fetch("/api/invoices", { cache: "no-store" }),
      fetch("/api/insights", { cache: "no-store" }),
    ]);
    if (!response.ok) throw new Error("Could not refresh invoices.");
    if (!insightResponse.ok) throw new Error("Could not refresh client insights.");
    const result = await response.json() as { invoices: InvoiceRow[]; remindersSentToday: number };
    const insightResult = await insightResponse.json() as { insights: ClientInsight[] };
    setInvoices(result.invoices);
    setRemindersSentToday(result.remindersSentToday);
    setClientInsights(insightResult.insights);
  }, []);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const [response, insightResponse] = await Promise.all([
          fetch("/api/invoices", { cache: "no-store" }),
          fetch("/api/insights", { cache: "no-store" }),
        ]);
        if (!response.ok) throw new Error("Could not load invoices.");
        if (!insightResponse.ok) throw new Error("Could not load client insights.");
        const result = await response.json() as { invoices: InvoiceRow[]; remindersSentToday: number };
        const insightResult = await insightResponse.json() as { insights: ClientInsight[] };
        if (active) {
          setInvoices(result.invoices);
          setRemindersSentToday(result.remindersSentToday);
          setClientInsights(insightResult.insights);
        }
      } catch (error) {
        if (active) setMessage(error instanceof Error ? error.message : "Could not load invoices.");
      }
    };
    void load();
    const timer = window.setInterval(() => void load(), 3000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    if (clients.length && !clients.some((client) => client.id === selectedClientId)) {
      setSelectedClientId(clients[0].id);
    }
  }, [clients, selectedClientId]);

  useEffect(() => {
    if (!selectedClientId) {
      setMessages([]);
      setUsedInvoiceIds([]);
      return;
    }
    let active = true;
    const loadMessages = async () => {
      try {
        const response = await fetch(`/api/clients/${encodeURIComponent(selectedClientId)}/messages`, { cache: "no-store" });
        if (!response.ok) throw new Error("Could not load the simulated conversation.");
        const result = await response.json() as { messages: SimulatorMessage[]; usedInvoiceIds: string[] };
        if (active) {
          setMessages(result.messages);
          setUsedInvoiceIds(result.usedInvoiceIds);
        }
      } catch (error) {
        if (active) setMessage(error instanceof Error ? error.message : "Could not load the simulated conversation.");
      }
    };
    void loadMessages();
    const timer = window.setInterval(() => void loadMessages(), 2000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [selectedClientId]);

  useEffect(() => {
    if (!selectedInvoice) return;
    const updated = invoices.find((invoice) => invoice.id === selectedInvoice.id);
    if (updated) setSelectedInvoice(updated);
  }, [invoices, selectedInvoice]);

  async function upload(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setMessage("");
    try {
      const body = new FormData();
      body.set("file", file);
      const response = await fetch("/api/invoices/upload", { method: "POST", body });
      const result = await response.json() as { created?: number; skipped?: number; errors?: { row: number; message: string }[]; error?: string };
      if (!response.ok) throw new Error(result.error ?? "CSV upload failed.");
      setMessage(`${result.created} invoices added. ${result.skipped ? `${result.skipped} rows were skipped.` : "The first messages are on their way."} ${result.errors?.slice(0, 2).map((error) => `Row ${error.row}: ${error.message}`).join(" ") ?? ""}`);
      await refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "CSV upload failed.");
    } finally {
      setBusy(false);
    }
  }

  async function performAction(invoiceId: string, action: "mark-paid" | "reject-claim" | "simulate-claim") {
    setMessage("");
    try {
      const url = action === "simulate-claim"
        ? `/api/demo/claim/${encodeURIComponent(invoiceId)}`
        : `/api/invoices/${encodeURIComponent(invoiceId)}/action`;
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        ...(action === "simulate-claim" ? {} : { body: JSON.stringify({ action }) }),
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "Invoice action failed.");
      await refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Invoice action failed.");
    }
  }

  async function useQuickReply(invoiceId: string) {
    setBusyClaimId(invoiceId);
    try {
      const response = await fetch(`/api/demo/claim/${encodeURIComponent(invoiceId)}`, { method: "POST" });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "Could not send the simulated reply.");
      const messagesResponse = await fetch(`/api/clients/${encodeURIComponent(selectedClientId)}/messages`, { cache: "no-store" });
      if (!messagesResponse.ok) throw new Error("The claim was sent, but the conversation could not be refreshed.");
      const messagesResult = await messagesResponse.json() as { messages: SimulatorMessage[]; usedInvoiceIds: string[] };
      setMessages(messagesResult.messages);
      setUsedInvoiceIds(messagesResult.usedInvoiceIds);
      await refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not send the simulated reply.");
    } finally {
      setBusyClaimId(null);
    }
  }

  return (
    <main className="dashboard-shell">
      <div className="topbar demo-toolbar">
        <span className="compression-label"><Icon name="clock" size={15} />Time compression on</span>
        <button className="mobile-phone-trigger" onClick={() => setPhoneOpen(true)}><Icon name="phone" size={16} />Phone simulator</button>
      </div>
      <section className="hero-strip">
        <div className="hero-intro">
          <p className="eyebrow-muted">Receivables · Demo Distributors</p>
          <h1>Money you’re owed.</h1>
          <p>A little more time for the work that matters.</p>
        </div>
        <div className="metric-grid">
          <article className="metric">
            <span className="metric-label">Outstanding</span>
            <strong><AnimatedAmount value={outstandingPaise} /></strong>
            <span className="metric-note">{invoices.filter((invoice) => !["PAID", "CANCELLED"].includes(invoice.status)).length} invoices still open</span>
          </article>
          <article className="metric">
            <span className="metric-label">Collected this month</span>
            <strong><AnimatedAmount value={collectedThisMonthPaise} /></strong>
            <span className="metric-note">Money received in {new Date().toLocaleDateString("en-IN", { month: "long" })}</span>
          </article>
          <article className="metric metric--quiet">
            <span className="metric-label">Reminders sent today</span>
            <strong className="metric-count"><AnimatedCount value={remindersSentToday} /></strong>
            <span className="metric-note">Messages delivered in demo</span>
          </article>
        </div>
      </section>

      <section
        className={`upload-strip${dragging ? " upload-strip--dragging" : ""}`}
        onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
        onDragLeave={(event) => { if (event.currentTarget === event.target) setDragging(false); }}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          void upload(event.dataTransfer.files[0]);
        }}
      >
        <div className="upload-mark"><Icon name="upload" size={18} /></div>
        <div className="upload-copy">
          <strong>Bring in your receivables</strong>
          <span>Drop a CSV here, or <label htmlFor="invoice-file">choose a file</label>. We’ll take it from there.</span>
        </div>
        <a className="sample-link" href="/samples/invoices.csv" download><Icon name="file" size={15} />Sample CSV <Icon name="arrow" size={14} /></a>
        <input
          className="visually-hidden"
          id="invoice-file"
          type="file"
          accept=".csv,text/csv"
          disabled={busy}
          onChange={(event) => {
            void upload(event.currentTarget.files?.[0]);
            event.currentTarget.value = "";
          }}
        />
      </section>
      {message && <p className="status-message" role="status">{message}</p>}

      <div className="workbench">
        <section className="invoice-section">
          <div className="section-heading">
            <div>
              <p className="eyebrow-muted">Your invoices</p>
              <h2>Every rupee, accounted for.</h2>
            </div>
            <span className="invoice-count">{invoices.length} {invoices.length === 1 ? "invoice" : "invoices"}</span>
          </div>
          <CollectionsOverview clients={clientInsights} invoices={invoices} />
          <div className="invoice-controls">
            <div className="invoice-tabs" role="tablist" aria-label="Filter invoices by status">
              {visibleTabs.map((tab) => (
                <button key={tab} type="button" role="tab" aria-selected={activeTab === tab} className={activeTab === tab ? "invoice-tab invoice-tab--active" : "invoice-tab"} onClick={() => setActiveTab(tab)}>
                  {tab === "approval" && <span className="approval-count">{invoiceCounts[tab]}</span>}
                  {tabLabels[tab]} <span className="invoice-tab-count">{invoiceCounts[tab]}</span>
                </button>
              ))}
            </div>
            <div className="invoice-search-sort">
              <label>Search invoices<input type="search" value={invoiceSearch} onChange={(event) => setInvoiceSearch(event.target.value)} placeholder="Client or invoice number" /></label>
              <label>Sort by<select value={invoiceSort} onChange={(event) => setInvoiceSort(event.target.value as InvoiceSort)}>
                <option value="dueDate">Due date</option>
                <option value="amount">Amount</option>
                <option value="client">Client</option>
              </select></label>
            </div>
          </div>
          <div className="invoice-table-wrap">
            <table className="invoice-table">
              <thead>
                <tr>
                  <th>Client &amp; invoice</th>
                  <th className="amount-column">Amount</th>
                  <th>Due</th>
                  <th>Status</th>
                  <th>Next reminder</th>
                  <th><span className="visually-hidden">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {visibleInvoices.map((invoice, index) => (
                  <tr
                    key={invoice.id}
                    className={`invoice-row${invoice.status === "PENDING_VERIFICATION" ? " invoice-row--verify" : ""}`}
                    style={{ animationDelay: `${Math.min(index * 28, 180)}ms` }}
                    onClick={() => setSelectedInvoice(invoice)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        setSelectedInvoice(invoice);
                      }
                    }}
                    tabIndex={0}
                    aria-label={`Open ${invoice.invoiceNumber} invoice journey`}
                  >
                    <td>
                      <div className="invoice-client">{invoice.client.name}</div>
                      <div className="invoice-number">{invoice.invoiceNumber}</div>
                    </td>
                    <td className="amount-column"><span className="row-amount tabular-nums">{formatAmount(invoice.amountPaise)}</span></td>
                    <td><time className="due-date" title={exactDate(invoice.dueDate)} dateTime={invoice.dueDate}>{relativeDueDate(invoice.dueDate)}</time></td>
                    <td><span className="status-label"><PingMark state={pingState(invoice.status)} />{statusLabels[invoice.status]}</span></td>
                    <td>
                      {invoice.nextReminder
                        ? <span className="next-reminder">{readableKind(invoice.nextReminder.kind)}<small>{formatTime(invoice.nextReminder.runAt)}</small></span>
                        : <span className="next-reminder next-reminder--empty">No reminder scheduled</span>}
                    </td>
                    <td className="row-actions" onClick={(event) => event.stopPropagation()}>
                      {invoice.status === "PENDING_VERIFICATION" ? (
                        <div className="action-menu">
                          <button className="text-action" onClick={() => void performAction(invoice.id, "mark-paid")}>Confirm paid</button>
                          <button className="text-action" onClick={() => void performAction(invoice.id, "reject-claim")}>Not paid yet</button>
                        </div>
                      ) : ["PENDING", "REMINDER_ACTIVE"].includes(invoice.status) ? (
                        <div className="action-menu">
                          <a href={`/pay/${encodeURIComponent(invoice.id)}`} target="_blank" rel="noreferrer" aria-label={`Open checkout for ${invoice.invoiceNumber}`} title="Open checkout"><Icon name="arrow" size={16} /></a>
                          <button className="text-action" onClick={() => void performAction(invoice.id, "mark-paid")}>Mark paid</button>
                        </div>
                      ) : <span className="row-action-empty">—</span>}
                    </td>
                  </tr>
                ))}
                {!visibleInvoices.length && (
                  <tr><td colSpan={6}>
                    <div className="empty-invoices">
                      <span className="empty-invoices-icon"><Icon name="file" size={22} /></span>
                      <strong>{activeTab === "approval" ? "Nothing waiting on you." : activeTab === "overdue" ? "Nothing overdue today." : "Nothing to chase today."}</strong>
                      <span>{invoiceSearch ? "Try a different search." : "Upload a receivables CSV and your first invoices will find their way here."}</span>
                    </div>
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
          <p className="table-hint">Select an invoice to see how its story unfolds.</p>
        </section>

        <PhoneSimulator
          clients={clients}
          selectedClientId={selectedClientId}
          onSelectClient={setSelectedClientId}
          messages={messages}
          usedInvoiceIds={usedInvoiceIds}
          onClaim={(invoiceId) => void useQuickReply(invoiceId)}
          busyClaimId={busyClaimId}
        />
      </div>

      {phoneOpen && (
        <div className="mobile-drawer-scrim" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setPhoneOpen(false);
        }}>
          <PhoneSimulator
            mobile
            clients={clients}
            selectedClientId={selectedClientId}
            onSelectClient={setSelectedClientId}
            messages={messages}
            usedInvoiceIds={usedInvoiceIds}
            onClaim={(invoiceId) => void useQuickReply(invoiceId)}
            busyClaimId={busyClaimId}
            onClose={() => setPhoneOpen(false)}
          />
        </div>
      )}

      {selectedInvoice && <InvoiceJourney invoice={selectedInvoice} onClose={() => setSelectedInvoice(null)} />}
    </main>
  );
}
