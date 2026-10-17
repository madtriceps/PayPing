"use client";

import Link from "next/link";
import Papa from "papaparse";
import { useEffect, useMemo, useState, type ChangeEvent } from "react";
import { EarlyAccessForm } from "@/components/lead-form";
import { PayPingIcon } from "@/components/icons";
import { PingMark } from "@/components/ping-mark";
import { siteContent } from "@/content/site";
import {
  COMPRESSED_REMINDER_DURATION_MS,
  COMPRESSED_REMINDER_INTERVAL_MS,
  COMPRESSED_REMINDER_SEQUENCE,
  reminderEventsDue,
} from "@/lib/reminder-sequence";

type InvoiceStatus = "open" | "paid" | "paused";
type GuidedInvoice = {
  id: string;
  clientName: string;
  invoiceNumber: string;
  amountPaise: number;
  dueDate: string;
  status: InvoiceStatus;
  remindersCancelled: boolean;
  cancelledReminderCount: number;
  remindersSentCount: number | null;
};

const money = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 });
const maximumClockMs = COMPRESSED_REMINDER_DURATION_MS;
const requiredHeaders = ["client_name", "client_phone", "invoice_number", "amount", "due_date"];

function sampleInvoices(): GuidedInvoice[] {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  return siteContent.guidedDemo.sampleInvoices.map((invoice) => {
    const dueDate = new Date(today);
    dueDate.setUTCDate(dueDate.getUTCDate() + invoice.dueInDays);
    return {
      ...invoice,
      id: invoice.invoiceNumber,
      dueDate: dueDate.toISOString().slice(0, 10),
      status: "open",
      remindersCancelled: false,
      cancelledReminderCount: 0,
      remindersSentCount: null,
    };
  });
}

function dueDateLabel(value: string) {
  return new Date(`${value}T00:00:00Z`).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

function timeLabel(milliseconds: number) {
  const seconds = Math.floor(milliseconds / 1000);
  return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}

function remindersElapsed(clockMs: number) {
  return reminderEventsDue(clockMs).filter((event) => event.kind !== "INITIAL_DISPATCH").length;
}

export function GuidedDemo() {
  const [invoices, setInvoices] = useState<GuidedInvoice[]>(sampleInvoices);
  const [selectedId, setSelectedId] = useState(invoices[0]?.id ?? "");
  const [clockMs, setClockMs] = useState(0);
  const [started, setStarted] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [sourceFile, setSourceFile] = useState("Sample invoices");

  const selectedInvoice = useMemo(
    () => invoices.find((invoice) => invoice.id === selectedId) ?? invoices[0],
    [invoices, selectedId],
  );
  const remindersSent = started ? remindersElapsed(clockMs) : 0;
  const finished = started && clockMs >= maximumClockMs;
  const showCallback = finished || invoices.some((invoice) => invoice.status !== "open");
  const reminderTimes = COMPRESSED_REMINDER_SEQUENCE.filter((event) => event.kind !== "INITIAL_DISPATCH");
  const displayedReminderCount = selectedInvoice?.status === "open"
    ? remindersSent
    : selectedInvoice?.remindersSentCount ?? 0;

  useEffect(() => {
    if (!playing) return;
    const timer = window.setInterval(() => setClockMs((current) => Math.min(current + 5_000, maximumClockMs)), 1_000);
    return () => window.clearInterval(timer);
  }, [playing]);

  useEffect(() => {
    if (clockMs >= maximumClockMs) setPlaying(false);
  }, [clockMs]);

  function startWalkthrough() {
    setStarted(true);
    setClockMs(0);
    setPlaying(false);
    setNotice(siteContent.guidedDemo.initialNotice);
    setError("");
  }

  function advanceClock() {
    setStarted(true);
    setPlaying(false);
    setClockMs((current) => Math.min(current + COMPRESSED_REMINDER_INTERVAL_MS, maximumClockMs));
    setNotice(siteContent.guidedDemo.advanceNotice);
  }

  function resetWalkthrough() {
    setInvoices((current) => current.map((invoice) => ({
      ...invoice,
      status: "open",
      remindersCancelled: false,
      cancelledReminderCount: 0,
      remindersSentCount: null,
    })));
    setClockMs(0);
    setStarted(false);
    setPlaying(false);
    setNotice("");
    setError("");
  }

  function updateSelectedStatus(status: Exclude<InvoiceStatus, "open">) {
    if (!selectedInvoice) return;
    setPlaying(false);
    setStarted(true);
    setInvoices((current) => current.map((invoice) => invoice.id === selectedInvoice.id
      ? {
          ...invoice,
          status,
          remindersCancelled: true,
          cancelledReminderCount: Math.max(0, reminderTimes.length - remindersSent),
          remindersSentCount: remindersSent,
        }
      : invoice));
    setNotice(status === "paid"
      ? siteContent.guidedDemo.paymentNotice
      : siteContent.guidedDemo.claimNotice);
  }

  async function loadLocalCsv(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    setError("");
    setNotice("");
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".csv")) {
      setError("Choose a CSV file.");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setError("Choose a CSV file smaller than 2 MB.");
      return;
    }
    try {
      const text = await file.text();
      const parsed = Papa.parse<Record<string, string>>(text, {
        header: true,
        skipEmptyLines: "greedy",
        transformHeader: (header) => header.trim().toLowerCase(),
      });
      if (parsed.errors.length) throw new Error("The CSV could not be read. Check its headers and rows.");
      const headers = parsed.meta.fields ?? [];
      const missing = requiredHeaders.filter((header) => !headers.includes(header));
      if (missing.length) throw new Error(`The CSV needs these columns: ${requiredHeaders.join(", ")}.`);
      const valid: GuidedInvoice[] = [];
      for (const [index, row] of parsed.data.entries()) {
        const amountPaise = Math.round(Number(row.amount) * 100);
        const phoneDigits = row.client_phone?.replace(/\D/g, "") ?? "";
        const dueDate = row.due_date?.trim();
        const parsedDate = dueDate ? new Date(`${dueDate}T00:00:00Z`) : null;
        const dateIsValid = parsedDate && !Number.isNaN(parsedDate.getTime()) && parsedDate.toISOString().slice(0, 10) === dueDate;
        if (!row.client_name?.trim() || !row.invoice_number?.trim() || phoneDigits.length < 8 || phoneDigits.length > 15 || !Number.isSafeInteger(amountPaise) || amountPaise <= 0 || !dateIsValid) continue;
        valid.push({
          id: `${file.name}-${index}`,
          clientName: row.client_name.trim(),
          invoiceNumber: row.invoice_number.trim(),
          amountPaise,
          dueDate,
          status: "open",
          remindersCancelled: false,
          cancelledReminderCount: 0,
          remindersSentCount: null,
        });
      }
      if (valid.length === 0) throw new Error("No usable invoice rows were found in that file.");
      setInvoices(valid);
      setSelectedId(valid[0].id);
      setClockMs(0);
      setStarted(false);
      setPlaying(false);
      setSourceFile(file.name);
      const skipped = parsed.data.length - valid.length;
      setNotice(`${valid.length} invoice${valid.length === 1 ? "" : "s"} loaded ${siteContent.guidedDemo.ownFileLoaded}${skipped ? ` ${skipped} invalid rows were skipped.` : ""}`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The CSV could not be read.");
    }
  }

  return (
    <main className="guided-demo-page">
      <section className="guided-demo-intro">
        <div>
          <span className="live-demo-badge"><span />Live demo</span>
          <p className="site-eyebrow">{siteContent.guidedDemo.eyebrow}</p>
          <h1>{siteContent.guidedDemo.headline}</h1>
          <p>{siteContent.guidedDemo.description}</p>
        </div>
        <Link className="guided-live-link" href="/demo/live">
          {siteContent.guidedDemo.liveBackend}<PayPingIcon name="Arrow" size={16} />
        </Link>
      </section>

      <div className="guided-demo-workspace">
        <section className="guided-ledger" aria-labelledby="guided-ledger-heading">
          <div className="guided-ledger-heading">
            <div>
              <p className="site-eyebrow">A small receivables list</p>
              <h2 id="guided-ledger-heading">One invoice, one clear trail.</h2>
            </div>
            <span className="guided-file-name">{sourceFile}</span>
          </div>
          <label className="guided-upload">
            <PayPingIcon name="Upload" size={19} />
            <span><strong>{siteContent.guidedDemo.uploadLabel}</strong><small>{siteContent.guidedDemo.privacyNote}</small></span>
            <input type="file" accept=".csv,text/csv" onChange={(event) => void loadLocalCsv(event)} />
          </label>
          <a className="guided-sample-link" href="/samples/invoices.csv" download>{siteContent.guidedDemo.sampleFile}<PayPingIcon name="Arrow" size={14} /></a>

          <div className="guided-invoice-list">
            {invoices.map((invoice) => {
              const selected = invoice.id === selectedInvoice?.id;
              const state = invoice.status === "paid" ? "paid" : invoice.status === "paused" ? "paused" : "waiting";
              const sentCount = invoice.status === "open" ? remindersSent : invoice.remindersSentCount ?? 0;
              return (
                <button
                  className={`guided-invoice-row${selected ? " guided-invoice-row--selected" : ""}`}
                  type="button"
                  key={invoice.id}
                  onClick={() => setSelectedId(invoice.id)}
                  aria-pressed={selected}
                >
                  <PingMark state={state} size={20} />
                  <span className="guided-invoice-identity"><strong>{invoice.clientName}</strong><small>{invoice.invoiceNumber} · due {dueDateLabel(invoice.dueDate)}</small></span>
                  <strong className="guided-invoice-amount tabular-nums">{money.format(invoice.amountPaise / 100)}</strong>
                  <span className={`guided-status guided-status--${invoice.status}`}>{invoice.status === "paid" ? siteContent.guidedDemo.paidStatus : invoice.status === "paused" ? siteContent.guidedDemo.pausedStatus : sentCount ? `${sentCount} ${siteContent.guidedDemo.remindersSentLabel}` : siteContent.guidedDemo.openStatus}</span>
                </button>
              );
            })}
          </div>

          <div className="guided-clock">
            <div className="guided-clock-face"><span>{siteContent.guidedDemo.virtualClock}</span><strong className="tabular-nums">{timeLabel(clockMs)}</strong></div>
            <div className="guided-clock-controls">
              {!started
                ? <button className="button-primary" type="button" onClick={startWalkthrough}>{siteContent.guidedDemo.start}</button>
                : <button className="button-primary" type="button" disabled={finished} onClick={advanceClock}>{siteContent.guidedDemo.advance}</button>}
              {started && !finished && <button className="guided-play-toggle" type="button" onClick={() => setPlaying((value) => !value)}>{playing ? siteContent.guidedDemo.pause : siteContent.guidedDemo.play}</button>}
              {started && <button className="guided-reset" type="button" onClick={resetWalkthrough}>{siteContent.guidedDemo.reset}</button>}
            </div>
          </div>
          <p className="guided-interaction-hint">{siteContent.guidedDemo.interactionHint}</p>
          <ol className="guided-timeline" aria-label="Reminder timeline">
            {siteContent.guidedDemo.timeline.map((step, index) => {
              const stepSent = started && (index === 0 || remindersSent >= index);
              return <li className={stepSent ? "guided-timeline__sent" : ""} key={step}>
                <PingMark state={stepSent ? "paid" : "waiting"} size={15} />
                <span><strong>{step}</strong><small>{index === 0 ? "at start" : `+${index * 20} seconds`}</small></span>
              </li>
            })}
          </ol>
          {(notice || error) && <p className={error ? "guided-feedback guided-feedback--error" : "guided-feedback"} role={error ? "alert" : "status"}>{error || notice}</p>}
        </section>

        <section className="guided-phone-panel" aria-label="Simulated WhatsApp conversation">
          <div className="guided-phone-panel-heading">
            <p className="site-eyebrow">Simulated WhatsApp · demo mode</p>
            <span>{selectedInvoice?.clientName ?? "Choose an invoice"}</span>
          </div>
          <div className="guided-phone">
            <div className="guided-phone-top"><span className="guided-phone-dot"><PingMark state="waiting" size={22} /></span><span><strong>PayPing</strong><small>Invoice follow-up</small></span><span className="guided-phone-time">{timeLabel(clockMs)}</span></div>
            <div className="guided-chat">
              {selectedInvoice ? (
                <>
                  <p className="guided-chat-date">TODAY</p>
                  <div className="guided-bubble">
                    <small>{siteContent.guidedDemo.invoice} {selectedInvoice.invoiceNumber}</small>
                    <p>Hi {selectedInvoice.clientName}, here is your invoice.</p>
                    <strong className="tabular-nums">{money.format(selectedInvoice.amountPaise / 100)}</strong>
                    <span>{siteContent.guidedDemo.due}: {dueDateLabel(selectedInvoice.dueDate)}</span>
                    <button type="button" disabled={selectedInvoice.status !== "open"} onClick={() => updateSelectedStatus("paid")}>{siteContent.guidedDemo.paymentAction}<PayPingIcon name="Arrow" size={14} /></button>
                    <button className={`guided-claim-button${selectedInvoice.status === "paused" ? " guided-claim-button--used" : ""}`} type="button" disabled={selectedInvoice.status !== "open"} onClick={() => updateSelectedStatus("paused")}>{selectedInvoice.status === "paused" ? siteContent.guidedDemo.pausedStatus : siteContent.guidedDemo.claimAction}</button>
                    <small className="guided-bubble-time">10:00 ✓✓</small>
                  </div>
                  {Array.from({ length: displayedReminderCount }).map((_, index) => (
                    <div className="guided-bubble guided-reminder" key={index}>
                      <p>{index === 0 ? `A kind reminder about invoice ${selectedInvoice.invoiceNumber}.` : `A follow-up about invoice ${selectedInvoice.invoiceNumber}.`}</p>
                      <small className="guided-bubble-time">10:{String(index + 20).padStart(2, "0")} ✓✓</small>
                    </div>
                  ))}
                  {displayedReminderCount < reminderTimes.length && (
                    <div className={`guided-bubble guided-next-bubble${selectedInvoice.status === "paid" ? " guided-next-bubble--cancelled" : selectedInvoice.status === "paused" ? " guided-next-bubble--paused" : ""}`} key={`next-${displayedReminderCount}`}>
                      <p>{siteContent.guidedDemo.nextReminder} · {siteContent.guidedDemo.timeline[displayedReminderCount + 1]}</p>
                      <small>{selectedInvoice.status === "open"
                        ? siteContent.guidedDemo.reminderScheduled
                        : selectedInvoice.status === "paused"
                          ? siteContent.guidedDemo.reminderPaused
                          : siteContent.guidedDemo.reminderCancelled}</small>
                    </div>
                  )}
                  {selectedInvoice.status === "paid" && <div className="guided-bubble guided-thanks">{siteContent.guidedDemo.thankYou}</div>}
                  {selectedInvoice.status === "paused" && <div className="guided-bubble guided-claim-note">{siteContent.guidedDemo.claimNote}</div>}
                  {selectedInvoice.remindersCancelled && (
                    <p className="guided-cancel-note"><PingMark state={selectedInvoice.status === "paused" ? "paused" : "paid"} size={15} />
                      {selectedInvoice.cancelledReminderCount > 0
                        ? `${selectedInvoice.cancelledReminderCount} ${siteContent.guidedDemo.upcomingRemindersCancelled}`
                        : siteContent.guidedDemo.noRemindersRemaining}
                    </p>
                  )}
                </>
              ) : <p className="guided-chat-empty">Load an invoice to see the conversation.</p>}
            </div>
          </div>
          <div className="guided-phone-foot"><span>Time moves only when you move it.</span><strong>{displayedReminderCount} {siteContent.guidedDemo.remindersSentLabel}</strong></div>
        </section>
      </div>

      {showCallback && <section className="guided-ending">
        <div>
          <p className="site-eyebrow">{siteContent.guidedDemo.endHeading}</p>
          <h2>{siteContent.guidedDemo.endBody}</h2>
          <p>{siteContent.guidedDemo.callbackHeading}</p>
        </div>
        <div className="guided-callback-form"><EarlyAccessForm /></div>
      </section>}
    </main>
  );
}
