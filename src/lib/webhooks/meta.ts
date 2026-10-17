import { InvoiceStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { DEMO_ORG_ID } from "@/lib/demo";
import { cancelInvoiceReminders } from "@/lib/queue/reminder.queue";

type MetaMessage = {
  id?: string;
  button?: { payload?: string };
  interactive?: {
    button_reply?: { id?: string };
    list_reply?: { id?: string };
  };
};

function collectMessages(payload: unknown): MetaMessage[] {
  if (!payload || typeof payload !== "object") return [];
  const root = payload as { entry?: { changes?: { value?: { messages?: MetaMessage[] } }[] }[]; message?: MetaMessage };
  return [
    ...(root.message ? [root.message] : []),
    ...(root.entry ?? []).flatMap((entry) =>
      (entry.changes ?? []).flatMap((change) => change.value?.messages ?? []),
    ),
  ];
}

export async function handleMetaWebhook(request: Request): Promise<Response> {
  if (process.env.DEMO_MODE !== "true") {
    return NextResponse.json({ error: "Meta signature validation is deferred to Phase 2." }, { status: 501 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload." }, { status: 400 });
  }

  const claims = collectMessages(body)
    .map((message) => ({
      externalId: message.id,
      payload: message.interactive?.button_reply?.id ?? message.interactive?.list_reply?.id ?? message.button?.payload,
    }))
    .filter((claim): claim is { externalId: string; payload: string } =>
      typeof claim.externalId === "string" &&
      typeof claim.payload === "string" &&
      claim.payload.startsWith("PAID_CLAIM:"),
    );
  let handled = 0;

  for (const claim of claims) {
    const inserted = await prisma.webhookEvent.createMany({
      data: [{ provider: "meta", externalId: claim.externalId }],
      skipDuplicates: true,
    });
    if (!inserted.count) continue;
    const invoiceId = claim.payload.slice("PAID_CLAIM:".length);
    const invoice = await prisma.invoice.findFirst({
      where: { id: invoiceId, organizationId: DEMO_ORG_ID },
      select: { id: true, status: true },
    });
    if (
      !invoice ||
      (invoice.status !== InvoiceStatus.PENDING && invoice.status !== InvoiceStatus.REMINDER_ACTIVE)
    ) continue;

    const updated = await prisma.invoice.updateMany({
      where: {
        id: invoice.id,
        status: { in: [InvoiceStatus.PENDING, InvoiceStatus.REMINDER_ACTIVE] },
      },
      data: { status: InvoiceStatus.PENDING_VERIFICATION, claimedPaidAt: new Date() },
    });
    if (!updated.count) continue;

    await cancelInvoiceReminders(invoice.id, "PENDING_VERIFICATION");
    await prisma.messageLog.create({
      data: {
        organizationId: DEMO_ORG_ID,
        invoiceId: invoice.id,
        direction: "INBOUND",
        kind: "BUTTON_REPLY",
        body: claim.payload,
      },
    });
    handled++;
  }
  return NextResponse.json({ ok: true, handled });
}
