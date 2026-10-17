import { createHmac } from "node:crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { DEMO_ORG_ID } from "@/lib/demo";
import { handleRazorpayWebhook } from "@/lib/webhooks/razorpay";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ invoiceId: string }> },
) {
  if (process.env.DEMO_MODE !== "true") {
    return NextResponse.json({ error: "Demo checkout is disabled." }, { status: 404 });
  }
  const { invoiceId } = await params;
  const invoice = await prisma.invoice.findFirst({
    where: { id: invoiceId, organizationId: DEMO_ORG_ID },
    select: { id: true, amountPaise: true, status: true },
  });
  if (!invoice) return NextResponse.json({ error: "Invoice not found." }, { status: 404 });
  if (invoice.status === "PAID") {
    return NextResponse.redirect(new URL(`/pay/${encodeURIComponent(invoiceId)}`, request.url), 303);
  }

  const eventId = `demo-${crypto.randomUUID()}`;
  const payload = JSON.stringify({
    event: "payment.captured",
    payload: {
      payment: {
        entity: {
          id: `pay_${crypto.randomUUID().replaceAll("-", "")}`,
          amount: invoice.amountPaise,
          currency: "INR",
          notes: { reference_id: invoice.id },
        },
      },
    },
  });
  const secret = process.env.DEMO_WEBHOOK_SECRET;
  if (!secret) return NextResponse.json({ error: "Demo webhook secret is not configured." }, { status: 500 });
  const signature = createHmac("sha256", secret).update(payload).digest("hex");

  const webhookResponse = await handleRazorpayWebhook(new Request(new URL("/api/webhooks/razorpay", request.url), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-razorpay-signature": signature,
      "x-razorpay-event-id": eventId,
    },
    body: payload,
  }));
  if (!webhookResponse.ok) return webhookResponse;
  return NextResponse.redirect(new URL(`/pay/${encodeURIComponent(invoiceId)}?paid=1`, request.url), 303);
}
