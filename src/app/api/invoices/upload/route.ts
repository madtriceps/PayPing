import { InvoiceStatus, Prisma } from "@prisma/client";
import Papa from "papaparse";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { DEMO_ORG_ID, isDemoModeEnabled } from "@/lib/demo";
import { scheduleInvoiceSequence } from "@/lib/queue/reminder.queue";

const REQUIRED_HEADERS = ["client_name", "client_phone", "invoice_number", "amount", "due_date"] as const;

const csvRowSchema = z.object({
  client_name: z.string().trim().min(1).max(200),
  client_phone: z.string().trim().min(1).max(40),
  invoice_number: z.string().trim().min(1).max(100),
  amount: z.string().trim().regex(/^\d+(?:\.\d{1,2})?$/, "amount must be rupees with up to 2 decimal places"),
  due_date: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, "due_date must use YYYY-MM-DD"),
});

function normalizePhone(input: string): string {
  const trimmed = input.trim();
  const digits = trimmed.replace(/\D/g, "");
  if (trimmed.startsWith("+")) return `+${digits}`;
  if (digits.length === 10) return `+91${digits}`;
  if (digits.length === 11 && digits.startsWith("0")) return `+91${digits.slice(1)}`;
  if (digits.length === 12 && digits.startsWith("91")) return `+${digits}`;
  return `+${digits}`;
}

function parseDueDate(value: string): Date | null {
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value ? null : date;
}

export async function POST(request: Request) {
  if (!isDemoModeEnabled()) {
    return NextResponse.json({ error: "Demo mode is disabled." }, { status: 404 });
  }
  try {
    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Choose a CSV file to upload." }, { status: 400 });
    }
    if (!file.name.toLowerCase().endsWith(".csv")) {
      return NextResponse.json({ error: "Only CSV files are supported." }, { status: 400 });
    }
    if (file.size > 2 * 1024 * 1024) {
      return NextResponse.json({ error: "CSV file must be 2 MB or smaller." }, { status: 413 });
    }

    const parsed = Papa.parse<Record<string, string>>(await file.text(), {
      header: true,
      skipEmptyLines: "greedy",
      transformHeader: (header) => header.trim().toLowerCase(),
    });
    const headers = parsed.meta.fields ?? [];
    const missingHeaders = REQUIRED_HEADERS.filter((header) => !headers.includes(header));
    if (missingHeaders.length) {
      return NextResponse.json({
        error: `CSV is missing required headers: ${missingHeaders.join(", ")}.`,
      }, { status: 400 });
    }
    if (parsed.errors.length) {
      return NextResponse.json({
        error: "CSV could not be parsed.",
        errors: parsed.errors.map((error) => error.message),
      }, { status: 400 });
    }

    const batch = await prisma.uploadBatch.create({
      data: {
        organizationId: DEMO_ORG_ID,
        fileName: file.name.slice(0, 255),
        totalRows: parsed.data.length,
      },
    });
    let created = 0;
    let skipped = 0;
    const errors: { row: number; message: string }[] = [];

    for (const [index, rawRow] of parsed.data.entries()) {
      const rowNumber = index + 2;
      const validated = csvRowSchema.safeParse(rawRow);
      if (!validated.success) {
        skipped++;
        errors.push({ row: rowNumber, message: validated.error.issues.map((issue) => issue.message).join("; ") });
        continue;
      }

      const row = validated.data;
      const amountPaise = Math.round(Number(row.amount) * 100);
      const phoneE164 = normalizePhone(row.client_phone);
      const dueDate = parseDueDate(row.due_date);
      if (!Number.isSafeInteger(amountPaise) || amountPaise <= 0) {
        skipped++;
        errors.push({ row: rowNumber, message: "amount must be a positive rupee amount." });
        continue;
      }
      if (!/^\+[1-9]\d{7,14}$/.test(phoneE164)) {
        skipped++;
        errors.push({ row: rowNumber, message: "client_phone must be a valid phone number." });
        continue;
      }
      if (!dueDate) {
        skipped++;
        errors.push({ row: rowNumber, message: "due_date must be a real calendar date in YYYY-MM-DD format." });
        continue;
      }

      try {
        const existing = await prisma.invoice.findUnique({
          where: {
            organizationId_invoiceNumber: {
              organizationId: DEMO_ORG_ID,
              invoiceNumber: row.invoice_number,
            },
          },
          select: { id: true },
        });
        if (existing) {
          skipped++;
          errors.push({ row: rowNumber, message: `Invoice ${row.invoice_number} already exists; skipped duplicate.` });
          continue;
        }

        const client = await prisma.client.upsert({
          where: {
            organizationId_phoneE164_name: {
              organizationId: DEMO_ORG_ID,
              phoneE164,
              name: row.client_name,
            },
          },
          create: { organizationId: DEMO_ORG_ID, name: row.client_name, phoneE164 },
          update: {},
        });
        const invoice = await prisma.invoice.create({
          data: {
            organizationId: DEMO_ORG_ID,
            clientId: client.id,
            batchId: batch.id,
            invoiceNumber: row.invoice_number,
            amountPaise,
            dueDate,
            status: InvoiceStatus.PENDING,
          },
        });
        await scheduleInvoiceSequence(invoice.id);
        created++;
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
          skipped++;
          errors.push({ row: rowNumber, message: `Invoice ${row.invoice_number} already exists; skipped duplicate.` });
          continue;
        }
        console.error(`Failed to import CSV row ${rowNumber}:`, error);
        errors.push({ row: rowNumber, message: "Could not import this row due to a server error." });
        skipped++;
      }
    }

    await prisma.uploadBatch.update({
      where: { id: batch.id },
      data: { createdRows: created, skippedRows: skipped, errors: errors.length ? errors : Prisma.JsonNull },
    });
    return NextResponse.json({ created, skipped, errors });
  } catch (error) {
    console.error("Invoice CSV upload failed:", error);
    return NextResponse.json({ error: "Could not process CSV upload." }, { status: 500 });
  }
}
