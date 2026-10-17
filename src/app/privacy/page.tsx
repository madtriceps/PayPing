import type { Metadata } from "next";

export const metadata: Metadata = { title: "Privacy | PayPing" };

export default function PrivacyPage() {
  return (
    <main className="legal-page">
      <p className="site-eyebrow">Privacy</p>
      <h1>Your information should be handled with care.</h1>
      <p className="legal-updated">Last updated: 17 October 2026</p>
      <h2>Information you share</h2>
      <p>If you book a demo, we store your name, business name, email address, optional phone number, invoice volume range, business role and any note you include. We use these details to respond to your request.</p>
      <h2>Product demo</h2>
      <p>The live demo is for demonstration only. It uses seeded and locally stored invoice data. Do not enter real customer or financial information into the demo.</p>
      <h2>Sharing and retention</h2>
      <p>We do not sell the contact details submitted here. We retain them while we follow up and for a reasonable period to manage the conversation. You can ask us to remove your information by contacting us using the details in the footer.</p>
      <h2>Changes and questions</h2>
      <p>This notice describes the current early-access site, not a production financial service. We will update it as the product and its data practices develop.</p>
    </main>
  );
}
