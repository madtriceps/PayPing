import { InvoiceStatus } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { DEMO_ORG_ID, isDemoModeEnabled } from "@/lib/demo";
import { resumeInvoiceReminders } from "@/lib/queue/reminder.queue";
import { markInvoicePaid } from "@/lib/payments";

const actionSchema = z.object({ action: z.enum(["mark-paid", "reject-claim"]) });

export async function POST(
  request: Request,
  { params }: { params: Promise<{ invoiceId: string }> },
) {
  if (!isDemoModeEnabled()) {
    return NextResponse.json({ error: "Demo mode is disabled." }, { status: 404 });
  }
  const parsed = actionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid invoice action." }, { status: 400 });

  try {
    const { invoiceId } = await params;
    const invoice = await prisma.invoice.findFirst({
      where: { id: invoiceId, organizationId: DEMO_ORG_ID },
      select: { id: true, status: true, amountPaise: true },
    });
    if (!invoice) return NextResponse.json({ error: "Invoice not found." }, { status: 404 });

    if (parsed.data.action === "mark-paid") {
      if (invoice.status === InvoiceStatus.PAID) return NextResponse.json({ ok: true });
      if (
        invoice.status !== InvoiceStatus.PENDING &&
        invoice.status !== InvoiceStatus.REMINDER_ACTIVE &&
        invoice.status !== InvoiceStatus.PENDING_VERIFICATION
      ) {
        return NextResponse.json({ error: "This invoice cannot be marked paid in its current state." }, { status: 409 });
      }
      await markInvoicePaid(invoice.id, {
        amountPaise: invoice.amountPaise,
        source: "MANUAL_OWNER",
        paymentId: `manual_${randomUUID()}`,
      });
      return NextResponse.json({ ok: true });
    }

    if (invoice.status !== InvoiceStatus.PENDING_VERIFICATION) {
      return NextResponse.json({ error: "This invoice has no pending paid claim." }, { status: 409 });
    }
    await prisma.invoice.updateMany({
      where: { id: invoice.id, status: InvoiceStatus.PENDING_VERIFICATION },
      data: { status: InvoiceStatus.REMINDER_ACTIVE, claimedPaidAt: null },
    });
    await resumeInvoiceReminders(invoice.id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Invoice action failed:", error);
    return NextResponse.json({ error: "Could not update the invoice." }, { status: 500 });
  }
}
