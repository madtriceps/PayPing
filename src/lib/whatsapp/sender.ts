/**
 * Contract between the worker and the WhatsApp layer. Implement against Meta Cloud API
 * (POST /{phone-number-id}/messages with type "template"). Kept as an interface so the
 * queue logic is testable without hitting Meta.
 */
export interface SendTemplateInput {
  organizationId: string;
  toE164: string;
  template: "INVOICE" | "REMINDER" | "THANKS";
  params: {
    clientName: string;
    invoiceNumber: string;
    amountFormatted: string; // e.g. "₹12,500.00"
    dueDateFormatted: string;
    paymentUrl: string;
    pdfUrl?: string | null;
    daysToDue?: number; // negative = overdue
  };
}

export interface SendResult {
  waMessageId: string;
}

/** Throw RetryableSendError for 429/5xx/network; PermanentSendError for invalid number, template rejected, etc. */
export class RetryableSendError extends Error {}
export class PermanentSendError extends Error {}

export interface WhatsAppSender {
  sendTemplate(input: SendTemplateInput): Promise<SendResult>;
}
