import type { Metadata } from "next";
import { EarlyAccessForm } from "@/components/lead-form";
import { siteContent } from "@/content/site";

export const metadata: Metadata = {
  title: "Book a demo | PayPing",
  description: siteContent.metadata.description,
};

export default function BookDemoPage() {
  return (
    <main className="form-page">
      <div className="form-page-copy">
        <p className="site-eyebrow">{siteContent.closing.eyebrow}</p>
        <h1>Let’s talk about the invoices you’re waiting on.</h1>
        <p>{siteContent.closing.body}</p>
        <p className="pricing-note">{siteContent.pricing.paidPlans}</p>
      </div>
      <div className="form-page-panel">
        <EarlyAccessForm />
      </div>
    </main>
  );
}
