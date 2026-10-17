import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { DEMO_ORG_ID, isDemoModeEnabled } from "@/lib/demo";
import { buildClientInsights, getAgingBuckets } from "@/lib/insights";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!isDemoModeEnabled()) {
    return NextResponse.json({ error: "Demo mode is disabled." }, { status: 404 });
  }
  try {
    const clients = await prisma.client.findMany({
      where: { organizationId: DEMO_ORG_ID },
      include: {
        invoices: {
          select: {
            id: true,
            invoiceNumber: true,
            amountPaise: true,
            dueDate: true,
            status: true,
            paidAt: true,
          },
          orderBy: { dueDate: "desc" },
        },
      },
      orderBy: { name: "asc" },
    });
    const input = clients.map((client) => ({
      id: client.id,
      name: client.name,
      invoices: client.invoices,
    }));
    const insights = buildClientInsights(input);
    const allInvoices = input.flatMap((client) => client.invoices);
    return NextResponse.json({
      insights: insights.map((insight) => ({
        ...insight,
        invoices: insight.invoices.map((invoice) => ({
          ...invoice,
          dueDate: new Date(invoice.dueDate).toISOString(),
          paidAt: invoice.paidAt ? new Date(invoice.paidAt).toISOString() : null,
        })),
      })),
      aging: getAgingBuckets(allInvoices),
    });
  } catch (error) {
    console.error("Failed to load collections insights:", error);
    return NextResponse.json({ error: "Could not load collections insights." }, { status: 500 });
  }
}
