import type { SendTemplateInput } from "./sender";

export function renderMessageBody(input: SendTemplateInput): string {
  const { clientName, invoiceNumber, amountFormatted, dueDateFormatted, paymentUrl } = input.params;
  if (input.template === "THANKS") {
    return `Thanks, ${clientName}. We’ve received ${amountFormatted} for invoice ${invoiceNumber}.`;
  }

  return [
    `Hi ${clientName},`,
    `Invoice ${invoiceNumber}`,
    `Amount: ${amountFormatted}`,
    `Due date: ${dueDateFormatted}`,
    `Pay securely: ${paymentUrl}`,
  ].join("\n");
}
