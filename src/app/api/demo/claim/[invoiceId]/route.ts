import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { DEMO_ORG_ID } from "@/lib/demo";
import { prisma } from "@/lib/prisma";
import { handleMetaWebhook } from "@/lib/webhooks/meta";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ invoiceId: string }> },
) {
  if (process.env.DEMO_MODE !== "true") {
    return NextResponse.json({ error: "Demo claim simulation is disabled." }, { status: 404 });
  }
  const { invoiceId } = await params;
  const invoice = await prisma.invoice.findFirst({
    where: { id: invoiceId, organizationId: DEMO_ORG_ID },
    select: { id: true },
  });
  if (!invoice) return NextResponse.json({ error: "Invoice not found." }, { status: 404 });

  return handleMetaWebhook(new Request(new URL("/api/webhooks/meta", request.url), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message: {
        id: `wamid.demo_${randomUUID()}`,
        interactive: { button_reply: { id: `PAID_CLAIM:${invoice.id}` } },
      },
    }),
  }));
}
