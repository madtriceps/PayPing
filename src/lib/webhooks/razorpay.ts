import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { DEMO_ORG_ID } from "@/lib/demo";
import { markInvoicePaid } from "@/lib/payments";

const paymentCapturedSchema = z.object({
  event: z.literal("payment.captured"),
  payload: z.object({
    payment: z.object({
      entity: z.object({
        id: z.string().min(1),
        amount: z.number().int().positive(),
        payment_link_id: z.string().nullable().optional(),
        notes: z.object({ reference_id: z.string().optional() }).passthrough().optional(),
        reference_id: z.string().optional(),
      }).passthrough(),
    }),
  }),
}).passthrough();

function isValidSignature(body: string, signature: string, secret: string): boolean {
  const expected = createHmac("sha256", secret).update(body).digest();
  let supplied: Buffer;
  try {
    supplied = Buffer.from(signature, "hex");
  } catch {
    return false;
  }
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}

export async function handleRazorpayWebhook(request: Request): Promise<Response> {
  const body = await request.text();
  const signature = request.headers.get("x-razorpay-signature") ?? "";
  const secret = process.env.DEMO_MODE === "true"
    ? process.env.DEMO_WEBHOOK_SECRET
    : process.env.RAZORPAY_WEBHOOK_SECRET;
  const eventId = request.headers.get("x-razorpay-event-id");
  if (!secret || !eventId) {
    return NextResponse.json({ error: "Webhook configuration or event ID is missing." }, { status: 400 });
  }
  if (!isValidSignature(body, signature, secret)) {
    return NextResponse.json({ error: "Invalid webhook signature." }, { status: 401 });
  }

  let input: z.infer<typeof paymentCapturedSchema>;
  try {
    input = paymentCapturedSchema.parse(JSON.parse(body));
  } catch {
    return NextResponse.json({ error: "Invalid or unsupported webhook payload." }, { status: 400 });
  }

  const payment = input.payload.payment.entity;
  const referenceId = payment.notes?.reference_id ?? payment.reference_id;
  if (!referenceId && !payment.payment_link_id) {
    return NextResponse.json({ error: "Payment does not reference an invoice or payment link." }, { status: 400 });
  }

  try {
    const inserted = await prisma.webhookEvent.createMany({
      data: [{ provider: "razorpay", externalId: eventId }],
      skipDuplicates: true,
    });
    if (!inserted.count) return NextResponse.json({ ok: true, duplicate: true });
  } catch (error) {
    console.error("Failed to record Razorpay webhook event:", error);
    return NextResponse.json({ error: "Could not record webhook event." }, { status: 500 });
  }

  try {
    const invoice = await prisma.invoice.findFirst({
      where: {
        ...(process.env.DEMO_MODE === "true" ? { organizationId: DEMO_ORG_ID } : {}),
        OR: [
          ...(referenceId ? [{ id: referenceId }] : []),
          ...(payment.payment_link_id ? [{ rzpPaymentLinkId: payment.payment_link_id }] : []),
        ],
      },
      select: { id: true },
    });
    if (!invoice) {
      await prisma.webhookEvent.delete({ where: { provider_externalId: { provider: "razorpay", externalId: eventId } } });
      return NextResponse.json({ error: "Invoice not found." }, { status: 404 });
    }
    await markInvoicePaid(invoice.id, {
      amountPaise: payment.amount,
      source: "RAZORPAY_WEBHOOK",
      paymentId: payment.id,
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    await prisma.webhookEvent.delete({
      where: { provider_externalId: { provider: "razorpay", externalId: eventId } },
    });
    console.error("Failed to process Razorpay payment event:", error);
    return NextResponse.json({ error: "Could not process payment event." }, { status: 500 });
  }
}
