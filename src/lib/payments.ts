import { InvoiceStatus, type PaymentSource } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { cancelInvoiceReminders } from "@/lib/queue/reminder.queue";
import { whatsappSender } from "@/lib/whatsapp";
import { renderMessageBody } from "@/lib/whatsapp/render-message";

type MarkInvoicePaidInput = {
  amountPaise: number;
  source: PaymentSource;
  paymentId: string;
};

export async function markInvoicePaid(
  invoiceId: string,
  input: MarkInvoicePaidInput,
): Promise<boolean> {
  const changed = await prisma.$transaction(async (transaction) => {
    const invoice = await transaction.invoice.findUnique({
      where: { id: invoiceId },
      select: {
        id: true,
        status: true,
        organizationId: true,
        invoiceNumber: true,
        client: { select: { name: true, phoneE164: true } },
      },
    });
    if (!invoice || invoice.status === InvoiceStatus.PAID) return null;
    if (
      invoice.status !== InvoiceStatus.PENDING &&
      invoice.status !== InvoiceStatus.REMINDER_ACTIVE &&
      invoice.status !== InvoiceStatus.PENDING_VERIFICATION
    ) return null;

    const update = await transaction.invoice.updateMany({
      where: {
        id: invoice.id,
        status: {
          in: [InvoiceStatus.PENDING, InvoiceStatus.REMINDER_ACTIVE, InvoiceStatus.PENDING_VERIFICATION],
        },
      },
      data: {
        status: InvoiceStatus.PAID,
        paidAt: new Date(),
        paidAmountPaise: input.amountPaise,
        paidSource: input.source,
        rzpPaymentId: input.source === "RAZORPAY_WEBHOOK" ? input.paymentId : undefined,
      },
    });
    if (!update.count) return null;
    return invoice;
  });

  if (!changed) return false;

  await cancelInvoiceReminders(invoiceId, "PAID");
  const messageInput = {
    organizationId: changed.organizationId,
    toE164: changed.client.phoneE164,
    template: "THANKS",
    params: {
      clientName: changed.client.name,
      invoiceNumber: changed.invoiceNumber,
      amountFormatted: (input.amountPaise / 100).toLocaleString("en-IN", { style: "currency", currency: "INR" }),
      dueDateFormatted: "",
      paymentUrl: "",
    },
  } as const;
  const { waMessageId } = await whatsappSender.sendTemplate(messageInput);
  await prisma.messageLog.create({
    data: {
      invoiceId,
      organizationId: changed.organizationId,
      direction: "OUTBOUND",
      kind: "THANKS",
      body: renderMessageBody(messageInput),
      waMessageId,
      status: "SENT",
    },
  });
  return true;
}
