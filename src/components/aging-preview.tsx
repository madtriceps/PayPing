"use client";

import { useEffect, useRef, useState } from "react";
import { siteContent } from "@/content/site";

const buckets = siteContent.aging.buckets;
const maxAmount = Math.max(...buckets.map((bucket) => bucket.amountRupees));
const rupees = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 });

export function AgingPreview() {
  const sectionRef = useRef<HTMLElement>(null);
  const [started, setStarted] = useState(false);
  const [shown, setShown] = useState(() => buckets.map(() => 0));

  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      setStarted(true);
      observer.disconnect();
    }, { threshold: 0.25 });
    observer.observe(section);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!started) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setShown(buckets.map((bucket) => bucket.amountRupees));
      return;
    }
    let frame = 0;
    const start = performance.now();
    const animate = (now: number) => {
      const progress = Math.min((now - start) / 650, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setShown(buckets.map((bucket) => bucket.amountRupees * eased));
      if (progress < 1) frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [started]);

  return (
    <section className="aging-preview-section" id="aging" ref={sectionRef}>
      <div className="aging-preview-copy">
        <p className="site-eyebrow">{siteContent.aging.eyebrow}</p>
        <h2>{siteContent.aging.headline}</h2>
        <p>{siteContent.aging.caption}</p>
        <span className="insights-data-stamp">{siteContent.aging.demoStamp}</span>
      </div>
      <div className="aging-preview-chart">
        {buckets.map((bucket, index) => (
          <div className="aging-bucket" key={bucket.label}>
            <div className="aging-bucket__heading">
              <strong>{bucket.label}</strong>
              <span>{bucket.invoiceCount} {bucket.invoiceCount === 1 ? "invoice" : "invoices"}</span>
            </div>
            <button
              type="button"
              className="aging-bucket__track"
              title={`${bucket.label}: ${rupees.format(bucket.amountRupees)}`}
              aria-label={`${bucket.label}: ${rupees.format(bucket.amountRupees)}, ${bucket.invoiceCount} ${bucket.invoiceCount === 1 ? "invoice" : "invoices"}`}
            >
              <span className={`aging-bucket__fill aging-bucket__fill--${index}`} style={{ width: `${(bucket.amountRupees / maxAmount) * 100}%` }} />
            </button>
            <strong className="aging-bucket__amount tabular-nums">{rupees.format(shown[index])}</strong>
          </div>
        ))}
      </div>
    </section>
  );
}
