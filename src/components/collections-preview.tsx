"use client";

import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { siteContent } from "@/content/site";
import { PingMark } from "@/components/ping-mark";

type SortKey = "outstandingPaise" | "avgDaysLate" | "onTimeRate";
const clients = siteContent.insights.clients;
const rupees = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 });
const percent = new Intl.NumberFormat("en-IN", { style: "percent", maximumFractionDigits: 0 });

export function CollectionsPreview() {
  const [sort, setSort] = useState<SortKey>("outstandingPaise");
  const listRef = useRef<HTMLOListElement>(null);
  const positions = useRef<Map<string, number>>(new Map());
  const sortedClients = useMemo(() => [...clients].sort((a, b) => {
    if (sort === "outstandingPaise") return b.outstandingPaise - a.outstandingPaise || a.name.localeCompare(b.name);
    if (sort === "avgDaysLate") return b.avgDaysLate - a.avgDaysLate || a.name.localeCompare(b.name);
    return b.onTimeRate - a.onTimeRate || a.name.localeCompare(b.name);
  }), [sort]);

  useLayoutEffect(() => {
    const oldPositions = positions.current;
    const elements = listRef.current?.querySelectorAll<HTMLElement>("[data-client-name]");
    if (!elements || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    elements.forEach((element) => {
      const oldTop = oldPositions.get(element.dataset.clientName ?? "");
      if (oldTop === undefined) return;
      const offset = oldTop - element.getBoundingClientRect().top;
      if (!offset) return;
      element.style.transition = "none";
      element.style.transform = `translateY(${offset}px)`;
      requestAnimationFrame(() => {
        element.style.transition = "transform 220ms cubic-bezier(0.2, 0.7, 0.25, 1)";
        element.style.transform = "";
      });
    });
    positions.current = new Map();
  }, [sort]);

  function selectSort(nextSort: SortKey) {
    const elements = listRef.current?.querySelectorAll<HTMLElement>("[data-client-name]");
    positions.current = new Map(Array.from(elements ?? []).map((element) => [
      element.dataset.clientName ?? "",
      element.getBoundingClientRect().top,
    ]));
    setSort(nextSort);
  }

  return (
    <section className="collections-preview-section" id="insights">
      <div className="collections-preview-heading">
        <div>
          <p className="site-eyebrow">{siteContent.insights.eyebrow}</p>
          <h2>{siteContent.insights.headline}</h2>
          <p>{siteContent.insights.description}</p>
        </div>
        <div className="insight-sort" role="group" aria-label={siteContent.insights.sortBy}>
          {siteContent.insights.sorts.map((label, index) => {
            const value: SortKey = ["outstandingPaise", "avgDaysLate", "onTimeRate"][index] as SortKey;
            return <button type="button" key={label} aria-pressed={sort === value} onClick={() => selectSort(value)}>{label}</button>;
          })}
        </div>
      </div>
      <div className="insights-data-stamp">{siteContent.insights.demoStamp}</div>
      <ol className="insight-preview-list" ref={listRef} aria-live="polite">
        {sortedClients.map((client) => (
          <li key={client.name} data-client-name={client.name} className="insight-preview-row">
            <PingMark state="waiting" size={20} />
            <span className="insight-preview-row__client"><strong>{client.name}</strong><small>{siteContent.insights.basedOn} {client.paidCount} {siteContent.insights.invoices}</small></span>
            <span className="insight-preview-row__metric"><small>{siteContent.insights.outstandingLabel}</small><strong>{rupees.format(client.outstandingPaise / 100)}</strong></span>
            <span className="insight-preview-row__metric">
              <small>{siteContent.insights.averageLateLabel}</small>
              <strong>{client.avgDaysLate < 0
                ? `${Math.abs(client.avgDaysLate).toFixed(1)} days early`
                : `${client.avgDaysLate.toFixed(1)} days late`}</strong>
            </span>
            <span className="insight-preview-row__metric"><small>{siteContent.insights.onTimeLabel}</small><strong>{percent.format(client.onTimeRate)}</strong></span>
          </li>
        ))}
      </ol>
    </section>
  );
}
