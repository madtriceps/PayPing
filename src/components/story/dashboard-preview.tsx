"use client";

import Link from "next/link";
import { useMemo, useRef, useState, type CSSProperties, type KeyboardEvent } from "react";
import { PingMark } from "@/components/ping-mark";
import { siteContent } from "@/content/site";
import { storyConfig } from "@/components/story/config";
import { useStoryProgress } from "@/components/story/use-story-progress";

const dashboard = siteContent.story.dashboard;
const currency = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 });
type Tab = typeof dashboard.tabs[number];
type SortOption = typeof dashboard.sortOptions[number];
type DemoInvoice = typeof dashboard.rows[number];

function activeCallout(progress: number) {
  if (progress < storyConfig.stageB.approvalCalloutEnd) return 0;
  if (progress < storyConfig.stageB.attentionCalloutEnd) return 1;
  if (progress < storyConfig.stageB.timelineCalloutEnd) return 2;
  return -1;
}

export function DashboardPreview() {
  const sectionRef = useRef<HTMLElement>(null);
  const progress = useStoryProgress(sectionRef);
  const [tab, setTab] = useState<Tab>("All");
  const [sort, setSort] = useState<SortOption>("Amount");
  const [selectedInvoice, setSelectedInvoice] = useState<DemoInvoice>(dashboard.rows[0]);
  const tabRefs = useRef(new Map<Tab, HTMLButtonElement>());
  const calloutIndex = activeCallout(progress);
  const callout = calloutIndex === 0
    ? dashboard.callouts[0]
    : calloutIndex === 1
      ? dashboard.callouts[1]
      : calloutIndex === 2
        ? dashboard.callouts[2]
        : undefined;
  const entrance = Math.min(1, progress / storyConfig.stageB.screenEnterEnd);
  const screenStyle = {
    transform: `perspective(1400px) translateX(${(1 - entrance) * 18}vw) rotateY(${(1 - entrance) * -12}deg) scale(${0.86 + entrance * 0.14})`,
    opacity: Math.min(1, progress / storyConfig.stageB.screenFadeEnd),
  } as CSSProperties;
  const rows = useMemo(() => {
    const visible = dashboard.rows.filter((row) => {
      if (tab === "All") return true;
      if (tab === "Needs your approval") return row.group === "approval";
      if (tab === "Active") return row.group === "active" || row.group === "overdue";
      if (tab === "Overdue") return row.group === "overdue" || row.group === "approval";
      return row.group === "paid";
    });
    return visible.sort((a, b) => sort === "Amount"
      ? b.amountPaise - a.amountPaise
      : a.client.localeCompare(b.client));
  }, [sort, tab]);
  const attentionInvoice = rows.find((row) => row.group === "overdue")?.invoice
    ?? rows.find((row) => row.group === "approval" || row.group === "active")?.invoice;

  function onTabKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const offset = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
    const destination = event.key === "Home" ? 0
      : event.key === "End" ? dashboard.tabs.length - 1
        : (index + offset + dashboard.tabs.length) % dashboard.tabs.length;
    if (event.key !== "Home" && event.key !== "End" && offset === 0) return;
    event.preventDefault();
    const nextTab = dashboard.tabs[destination];
    if (!nextTab) return;
    setTab(nextTab);
    tabRefs.current.get(nextTab)?.focus();
  }

  return (
    <section
      className={`dashboard-story${progress > 0.02 ? " dashboard-story--entered" : ""}`}
      ref={sectionRef}
      aria-labelledby="dashboard-story-heading"
      style={{
        "--story-stage-height": `${storyConfig.stageB.heightVh}vh`,
        "--story-transition-ms": `${storyConfig.transitionMs}ms`,
        "--story-row-stagger-ms": `${storyConfig.rowStaggerMs}ms`,
        "--story-hotspot-pulse-ms": `${storyConfig.hotspotPulseMs}ms`,
      } as CSSProperties}
    >
      <div className="dashboard-story__sticky">
        <div className="dashboard-story__intro">
          <p className="site-eyebrow">{dashboard.eyebrow}</p>
          <h2 id="dashboard-story-heading">{dashboard.headline}</h2>
        </div>
        <div className="dashboard-preview-screen" style={screenStyle}>
          <div className="dashboard-preview-header">
            <span className="dashboard-preview-brand"><PingMark state="waiting" size={21} />PayPing</span>
            <span className="dashboard-preview-stamp">{dashboard.demoData}</span>
          </div>
          <div className="dashboard-preview-controls">
            <div className="dashboard-preview-tabs" role="tablist" aria-label="Demo invoice filters">
              {dashboard.tabs.map((label, index) => (
                <button
                  type="button"
                  role="tab"
                  className={calloutIndex === 0 && label === "Needs your approval" ? "dashboard-preview-hotspot" : undefined}
                  id={`dashboard-filter-${index}`}
                  aria-controls="dashboard-filter-panel"
                  aria-selected={tab === label}
                  tabIndex={tab === label ? 0 : -1}
                  key={label}
                  ref={(element) => {
                    if (element) tabRefs.current.set(label, element);
                    else tabRefs.current.delete(label);
                  }}
                  onClick={() => setTab(label)}
                  onKeyDown={(event) => onTabKeyDown(event, index)}
                >{label}</button>
              ))}
            </div>
            <label className="dashboard-preview-sort">{dashboard.sortLabel}
              <select value={sort} onChange={(event) => {
                const option = dashboard.sortOptions.find((candidate) => candidate === event.target.value);
                if (option) setSort(option);
              }}>
                {dashboard.sortOptions.map((option) => <option key={option}>{option}</option>)}
              </select>
            </label>
          </div>
          <div className="dashboard-preview-panel" role="tabpanel" id="dashboard-filter-panel" aria-labelledby={`dashboard-filter-${dashboard.tabs.indexOf(tab)}`} tabIndex={0}>
            <div className="dashboard-preview-table" role="group" aria-label="Sample invoices">
              <div className="dashboard-preview-row dashboard-preview-row--head" aria-hidden="true">
                <span>Client · invoice</span>
                <span>{dashboard.amountLabel}</span>
                <span>{dashboard.dueLabel}</span>
                <span>{dashboard.statusLabel}</span>
              </div>
              {rows.map((row, index) => (
                <button
                  type="button"
                  className={`dashboard-preview-row${selectedInvoice.invoice === row.invoice ? " dashboard-preview-row--selected" : ""}${calloutIndex === 1 && row.invoice === attentionInvoice ? " dashboard-preview-hotspot" : ""}`}
                  key={row.invoice}
                  style={{ "--row-index": index } as CSSProperties}
                  onClick={() => setSelectedInvoice(row)}
                  aria-pressed={selectedInvoice.invoice === row.invoice}
                >
                  <span className="dashboard-preview-client"><strong>{row.client}</strong><small>{row.invoice}</small></span>
                  <strong className="tabular-nums">{currency.format(row.amountPaise / 100)}</strong>
                  <span>{row.due}</span>
                  <span className="dashboard-preview-status"><PingMark state={row.group === "paid" ? "paid" : row.group === "approval" ? "paused" : "waiting"} size={15} />{row.status}</span>
                </button>
              ))}
              {rows.length === 0 && <p className="dashboard-preview-empty">Nothing in this list right now.</p>}
            </div>
            <div className={`dashboard-preview-timeline${calloutIndex === 2 ? " dashboard-preview-hotspot" : ""}`} aria-live="polite">
              <strong>Invoice timeline · {selectedInvoice.invoice}</strong>
              <span>Uploaded <i /> Dispatched <i /> Reminders scheduled <i /> {selectedInvoice.group === "paid" ? "Paid" : "Awaiting next step"}</span>
            </div>
          </div>
        </div>
        <div className={`dashboard-preview-callout${calloutIndex < 0 ? " dashboard-preview-callout--settled" : ""}`} aria-live="polite">
          {callout ? (
            <>
              <PingMark state="waiting" size={21} />
              <span><strong>{callout.title}</strong><small>{callout.body}</small></span>
            </>
          ) : <span><strong>Explore the demo screen</strong><small>Filter invoices, sort amounts and open a timeline.</small></span>}
          <Link href="/demo">{dashboard.tryLive}<span aria-hidden="true"> ↗</span></Link>
        </div>
        <ul className="dashboard-preview-callout__sr-only">
          {dashboard.callouts.map((callout) => <li key={callout.title}>{callout.title}: {callout.body}</li>)}
        </ul>
      </div>
    </section>
  );
}
