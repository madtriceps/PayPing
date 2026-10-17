import type { Metadata } from "next";

export const metadata: Metadata = { title: "Terms | PayPing" };

export default function TermsPage() {
  return (
    <main className="legal-page">
      <p className="site-eyebrow">Terms</p>
      <h1>A few things to know before using the demo.</h1>
      <p className="legal-updated">Last updated: 17 October 2026</p>
      <h2>Early-access product</h2>
      <p>PayPing is under development. Features, integrations and availability may change. The public demo simulates invoice reminders, customer responses and payments; it does not send WhatsApp messages or charge a payment method.</p>
      <h2>Demo data</h2>
      <p>Use the seeded demo data only. Do not upload real personal, client, invoice or payment information to this public experience.</p>
      <h2>No financial or legal advice</h2>
      <p>PayPing is a software tool, not financial, legal, tax or debt-collection advice. You remain responsible for your communications and for verifying payments.</p>
      <h2>Third-party services</h2>
      <p>Any future integrations will be subject to the relevant provider’s terms. PayPing is not affiliated with Meta, WhatsApp or Razorpay.</p>
      <h2>Questions</h2>
      <p>If you have a question about these terms, please use the Book a demo form.</p>
    </main>
  );
}
