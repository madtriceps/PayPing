import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { DEMO_ORG_ID, isDemoModeEnabled } from "@/lib/demo";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!isDemoModeEnabled()) {
    return NextResponse.json({ error: "Demo mode is disabled." }, { status: 404 });
  }
  try {
    const invoices = await prisma.invoice.findMany({
      where: { organizationId: DEMO_ORG_ID },
      include: {
        client: { select: { id: true, name: true, phoneE164: true } },
        reminders: {
          orderBy: { runAt: "asc" },
          select: { runAt: true, kind: true, state: true, firedAt: true },
        },
        messages: {
          orderBy: { createdAt: "asc" },
          select: { id: true, direction: true, kind: true, body: true, status: true, createdAt: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });
    const utcToday = new Date();
    utcToday.setUTCHours(0, 0, 0, 0);
    const remindersSentToday = await prisma.messageLog.count({
      where: {
        organizationId: DEMO_ORG_ID,
        direction: "OUTBOUND",
        kind: { not: "THANKS" },
        createdAt: { gte: utcToday },
      },
    });

    return NextResponse.json({
      remindersSentToday,
      invoices: invoices.map((invoice) => ({
        ...invoice,
        dueDate: invoice.dueDate.toISOString(),
        createdAt: invoice.createdAt.toISOString(),
        paidAt: invoice.paidAt?.toISOString() ?? null,
        nextReminder: invoice.reminders.find((reminder) => reminder.state === "SCHEDULED") ?? null,
        reminders: invoice.reminders.map((reminder) => ({
          ...reminder,
          runAt: reminder.runAt.toISOString(),
          firedAt: reminder.firedAt?.toISOString() ?? null,
        })),
        messages: invoice.messages.map((message) => ({
          ...message,
          createdAt: message.createdAt.toISOString(),
        })),
      })),
    });
  } catch (error) {
    console.error("Failed to load invoices:", error);
    return NextResponse.json({ error: "Could not load invoices." }, { status: 500 });
  }
}
