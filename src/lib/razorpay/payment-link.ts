import { prisma } from "@/lib/prisma";

export async function ensurePaymentLink(invoiceId: string): Promise<string> {
  if (process.env.DEMO_MODE !== "true") {
    throw new Error("Razorpay payment links are unavailable until Phase 2.");
  }

  const invoice = await prisma.invoice.findUniqueOrThrow({
    where: { id: invoiceId },
    select: { id: true, rzpShortUrl: true },
  });
  if (invoice.rzpShortUrl) return invoice.rzpShortUrl;

  const paymentUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/pay/${encodeURIComponent(invoice.id)}`;
  await prisma.invoice.updateMany({
    where: { id: invoice.id, rzpShortUrl: null },
    data: { rzpShortUrl: paymentUrl },
  });
  const updated = await prisma.invoice.findUniqueOrThrow({
    where: { id: invoice.id },
    select: { rzpShortUrl: true },
  });

  if (!updated.rzpShortUrl) throw new Error(`Failed to save demo payment URL for invoice ${invoiceId}`);
  return updated.rzpShortUrl;
}
