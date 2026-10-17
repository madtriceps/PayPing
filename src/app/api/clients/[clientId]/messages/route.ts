import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { DEMO_ORG_ID, isDemoModeEnabled } from "@/lib/demo";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ clientId: string }> },
) {
  if (!isDemoModeEnabled()) {
    return NextResponse.json({ error: "Demo mode is disabled." }, { status: 404 });
  }

  try {
    const { clientId } = await params;
    const messages = await prisma.messageLog.findMany({
      where: {
        organizationId: DEMO_ORG_ID,
        direction: "OUTBOUND",
        invoice: { clientId },
      },
      include: {
        invoice: {
          select: {
            id: true,
            invoiceNumber: true,
            amountPaise: true,
            dueDate: true,
            rzpShortUrl: true,
            status: true,
            client: { select: { name: true } },
          },
        },
      },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    });
    const claims = await prisma.messageLog.findMany({
      where: {
        organizationId: DEMO_ORG_ID,
        direction: "INBOUND",
        kind: "BUTTON_REPLY",
        invoice: { clientId },
      },
      select: { invoiceId: true },
    });

    return NextResponse.json({
      messages: messages.map((message) => ({
        id: message.id,
        kind: message.kind,
        body: message.body,
        createdAt: message.createdAt.toISOString(),
        invoice: message.invoice && {
          ...message.invoice,
          dueDate: message.invoice.dueDate.toISOString(),
        },
      })),
      usedInvoiceIds: [...new Set(claims.map((claim) => claim.invoiceId).filter((id): id is string => Boolean(id)))],
    });
  } catch (error) {
    console.error("Failed to load simulated WhatsApp messages:", error);
    return NextResponse.json({ error: "Could not load simulated messages." }, { status: 500 });
  }
}
