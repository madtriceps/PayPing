import type { Metadata } from "next";
import Link from "next/link";
import { AgingPreview } from "@/components/aging-preview";
import { CollectionsPreview } from "@/components/collections-preview";
import { EarlyAccessForm } from "@/components/lead-form";
import { PayPingIcon } from "@/components/icons";
import { PhoneLoop } from "@/components/phone-loop";
import { PingDivider } from "@/components/ping-divider";
import { ReportsSection } from "@/components/report-previews";
import { Reveal } from "@/components/reveal";
import { DashboardPreview } from "@/components/story/dashboard-preview";
import { StoryProgress } from "@/components/story/story-progress";
import { StoryStage } from "@/components/story/story-stage";
import { siteContent } from "@/content/site";

export const metadata: Metadata = {
  title: siteContent.metadata.title,
  description: siteContent.metadata.description,
  openGraph: {
    title: siteContent.metadata.title,
    description: siteContent.metadata.openGraphDescription,
    type: "website",
    images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: "PayPing — Get paid. Don't chase." }],
  },
  twitter: {
    card: "summary_large_image",
    title: siteContent.metadata.title,
    description: siteContent.metadata.openGraphDescription,
    images: ["/opengraph-image"],
  },
};

export default function HomePage() {
  return (
    <main className="marketing-site">
      <StoryProgress />
      <section className="landing-hero" id="product">
        <div className="landing-hero-copy">
          <p className="site-eyebrow">{siteContent.hero.eyebrow}</p>
          <h1>{siteContent.hero.headline}<br /><em>{siteContent.hero.emphasis}</em></h1>
          <p className="landing-subline">{siteContent.hero.subline}</p>
          <div className="hero-actions">
            <Link className="button-primary" href="/book-demo">{siteContent.navigation.book}</Link>
            <Link className="button-secondary" href="/demo">{siteContent.navigation.tryLive}<PayPingIcon name="Arrow" size={15} /></Link>
          </div>
        </div>
        <PhoneLoop />
      </section>

      <StoryStage />
      <DashboardPreview />
      <PingDivider />

      <Reveal>
        <section className="promise-section" id="promise">
          <p className="site-eyebrow">{siteContent.promise.eyebrow}</p>
          <h2>{siteContent.promise.headline}</h2>
          <div className="promise-diagram">
            {siteContent.promise.lanes.map((lane, index) => (
              <div className="promise-lane" key={lane.title}>
                <span className="promise-mark"><PayPingIcon name={index === 0 ? "Paid" : "Pause"} size={22} /></span>
                <span><strong>{lane.title}</strong><small>{lane.body}</small></span>
                <span className="promise-lane__line" aria-hidden="true" />
              </div>
            ))}
            <div className="promise-outcome"><PingMarkPaid /><strong>{siteContent.promise.outcome}</strong></div>
          </div>
          <p className="promise-owner-note">{siteContent.promise.note}</p>
        </section>
      </Reveal>
      <PingDivider />

      <Reveal><CollectionsPreview /></Reveal>
      <PingDivider />

      <Reveal><AgingPreview /></Reveal>
      <PingDivider />

      <Reveal><ReportsSection /></Reveal>
      <PingDivider />

      <Reveal>
        <section className="who-section" id="who">
          <p className="site-eyebrow">{siteContent.audiences.eyebrow}</p>
          <ol className="who-lines">
            {siteContent.audiences.entries.map((entry, index) => (
              <li key={entry.title}><span>{String(index + 1).padStart(2, "0")}</span><div><h2>{entry.title}</h2><p>{entry.body}</p></div></li>
            ))}
          </ol>
        </section>
      </Reveal>
      <PingDivider />

      <Reveal>
        <section className="comparison-section" id="comparison">
          <div className="section-intro">
            <p className="site-eyebrow">{siteContent.comparison.eyebrow}</p>
            <h2>{siteContent.comparison.headline}</h2>
          </div>
          <div className="comparison-table-wrap">
            <table className="comparison-table">
              <thead><tr><th></th>{siteContent.comparison.columns.map((column) => <th key={column}>{column}</th>)}</tr></thead>
              <tbody>{siteContent.comparison.rows.map((row) => (
                <tr key={row.label}><th>{row.label}</th>{row.values.map((value, index) => <td className={index === 2 ? "comparison-table__payping" : ""} key={index}>{value}</td>)}</tr>
              ))}</tbody>
            </table>
          </div>
        </section>
      </Reveal>
      <PingDivider />

      <Reveal>
        <section className="pricing-section" id="pricing">
          <div className="section-intro">
            <p className="site-eyebrow">{siteContent.pricing.eyebrow}</p>
            <h2>{siteContent.pricing.headline}</h2>
          </div>
          <div className="pilot-panel">
            <div><p className="pilot-label">{siteContent.pricing.pilotName}</p><p className="pilot-description">{siteContent.pricing.pilotDescription}</p></div>
            <p className="pilot-limit"><strong>{siteContent.pricing.pilotInvoiceLimit}</strong><span>{siteContent.pricing.limitLabel}</span></p>
            <p className="pilot-confirm">{siteContent.pricing.confirmNote}</p>
            <Link className="button-primary" href="/book-demo">{siteContent.pricing.book}</Link>
          </div>
          <p className="pricing-contact"><Link href="/book-demo">{siteContent.pricing.paidPlans}</Link></p>
        </section>
      </Reveal>
      <PingDivider />

      <Reveal>
        <section className="faq-section" id="faq">
          <div className="section-intro">
            <p className="site-eyebrow">{siteContent.faq.eyebrow}</p>
            <h2>{siteContent.faq.headline}</h2>
          </div>
          <div className="faq-list">
            {siteContent.faq.entries.map(({ question, answer }) => (
              <details key={question}>
                <summary>{question}<span aria-hidden="true">+</span></summary>
                <p>{answer}</p>
              </details>
            ))}
          </div>
        </section>
      </Reveal>

      <Reveal>
        <section className="closing-section" id="early-access">
          <div className="closing-copy">
            <p className="site-eyebrow">{siteContent.closing.eyebrow}</p>
            <h2>{siteContent.closing.headline}</h2>
            <p>{siteContent.closing.body}</p>
            <p className="pricing-note">{siteContent.pricing.paidPlans}</p>
          </div>
          <div className="closing-form">
            <p className="site-eyebrow">{siteContent.form.title}</p>
            <EarlyAccessForm />
          </div>
        </section>
      </Reveal>
    </main>
  );
}

function PingMarkPaid() {
  return <span className="promise-outcome__mark"><span className="promise-outcome__ring" /><PayPingIcon name="Paid" size={18} /></span>;
}
