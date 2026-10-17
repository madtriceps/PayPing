import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ClientInsights } from "@/components/client-insights";
import { DEMO_ORG_ID, isDemoModeEnabled } from "@/lib/demo";
import { prisma } from "@/lib/prisma";
import { buildClientInsights } from "@/lib/insights";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Client collections | PayPing",
  description: "Review demo client payment history and outstanding invoices.",
};

export default async function DemoClientsPage({
  searchParams,
}: {
  searchParams: Promise<{ clientId?: string }>;
}) {
  if (!process.env.DATABASE_URL || !process.env.REDIS_URL) {
    return (
      <main className="demo-unavailable">
        <p className="site-eyebrow">Client insights</p>
        <h1>The live demo runs locally.</h1>
        <p>Client payment history is available in the local demo.</p>
        <a className="button-primary" href="/demo/live">Back to live demo</a>
      </main>
    );
  }
  if (!isDemoModeEnabled()) notFound();
  const [{ clientId }, clients] = await Promise.all([
    searchParams,
    prisma.client.findMany({
      where: { organizationId: DEMO_ORG_ID },
      include: {
        invoices: {
          select: { id: true, invoiceNumber: true, amountPaise: true, dueDate: true, status: true, paidAt: true },
        },
      },
      orderBy: { name: "asc" },
    }),
  ]);
  const insights = buildClientInsights(clients.map((client) => ({
    id: client.id,
    name: client.name,
    invoices: client.invoices,
  })));
  return (
    <main className="clients-page">
      <div className="clients-page-heading">
        <div><p className="site-eyebrow">Demo data · 8 clients with payment history</p><h1>Know who to follow up with.</h1></div>
        <a className="button-secondary" href="/demo/live">Back to invoices</a>
      </div>
      <ClientInsights clients={insights} initialClientId={clientId} />
    </main>
  );
}
