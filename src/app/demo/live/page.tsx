import type { Metadata } from "next";
import Link from "next/link";
import { InvoiceDashboard } from "@/components/invoice-dashboard";

export const metadata: Metadata = {
  title: "Local invoice dashboard | PayPing",
  description: "The backend-driven PayPing invoice dashboard with seeded demo data.",
};

export default function LiveDashboardPage() {
  if (!process.env.DATABASE_URL || !process.env.REDIS_URL) {
    return (
      <main className="demo-unavailable">
        <p className="site-eyebrow">Local invoice dashboard</p>
        <h1>The backend demo runs locally.</h1>
        <p>Invoice data and reminders need the local database and queue. The guided demo runs here without them.</p>
        <Link className="button-primary" href="/demo">Try the guided demo</Link>
      </main>
    );
  }
  return <InvoiceDashboard />;
}
