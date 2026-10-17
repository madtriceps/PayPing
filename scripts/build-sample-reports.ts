import fs from "node:fs/promises";
import path from "node:path";
import { createWriteStream } from "node:fs";
import { finished } from "node:stream/promises";
import PDFDocument from "pdfkit";
import { siteContent } from "../src/content/site";

const outputDirectory = path.resolve(process.cwd(), "public", "samples");
const fontFile = path.resolve(
  process.cwd(),
  "node_modules",
  "@fontsource",
  "ibm-plex-sans",
  "files",
  "ibm-plex-sans-latin-400-normal.woff2",
);
const money = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 });
const reportFiles = [
  "weekly-collections-summary.pdf",
  "receivables-aging.pdf",
  "client-payment-behaviour.pdf",
];

async function renderReport(index: number) {
  const report = siteContent.reportsPage.reports[index];
  const destination = path.join(outputDirectory, reportFiles[index]);
  const doc = new PDFDocument({ size: "A4", margin: 48, info: { Title: report.title, Author: "PayPing" } });
  doc.registerFont("Plex", fontFile);
  const output = createWriteStream(destination);
  doc.pipe(output);

  doc.rect(0, 0, doc.page.width, 112).fill("#0b1512");
  doc.font("Plex").fontSize(10).fillColor("#a9c9bb").text("PAYPING  /  COLLECTIONS", 48, 31, { characterSpacing: 1.2 });
  doc.fontSize(8).fillColor("#19c48a").text(siteContent.reports.sample, 48, 53);
  doc.fontSize(22).fillColor("#ffffff").text(report.title, 48, 72);
  doc.y = 134;

  if (index === 0) {
    sectionHeading(doc, "Weekly collections at a glance");
    for (const row of siteContent.reports.weeklyRows) {
      doc.fontSize(10).fillColor("#53615a").text(row.label, { continued: true });
      doc.fontSize(10).fillColor("#0b1512").text(row.value, { align: "right" });
      doc.moveDown(0.3);
    }
    sectionHeading(doc, siteContent.reports.topChaseLabel);
    drawTable(doc, ["Client", "Invoice", "Amount", "Due"], siteContent.reports.topChaseInvoices.map((invoice) => [
      invoice.name,
      invoice.invoiceNumber,
      money.format(invoice.amountPaise / 100),
      invoice.dueLabel,
    ]), [120, 110, 100, 125]);
    note(doc, siteContent.reports.weeklyFootnote);
  } else if (index === 1) {
    sectionHeading(doc, "Open receivables by due date");
    for (const bucket of siteContent.aging.buckets) {
      doc.fontSize(12).fillColor("#0b1512").text(bucket.label, { continued: true });
      doc.fontSize(10).fillColor("#0e8f6b").text(money.format(bucket.amountRupees), { align: "right" });
      doc.fontSize(9).fillColor("#64716a").text(`${bucket.invoiceCount} open ${bucket.invoiceCount === 1 ? "invoice" : "invoices"}`);
      doc.moveDown(0.3);
      drawTable(doc, ["Client", "Open balance"], bucket.clients.map((client) => [
        client.name,
        money.format(client.amountRupees),
      ]), [280, 175]);
      doc.moveDown(0.55);
    }
    note(doc, siteContent.reports.agingFootnote);
  } else {
    sectionHeading(doc, "Payment history");
    drawTable(
      doc,
      ["Client", "Average timing", "On-time", "Based on"],
      siteContent.insights.clients.map((client) => [
        client.name,
        client.avgDaysLate < 0
          ? `${Math.abs(Math.round(client.avgDaysLate))} ${siteContent.reports.daysEarly}`
          : `${Math.round(client.avgDaysLate)} ${siteContent.reports.daysLate}`,
        new Intl.NumberFormat("en-IN", { style: "percent", maximumFractionDigits: 0 }).format(client.onTimeRate),
        `${client.paidCount} ${siteContent.reports.invoiceCount}`,
      ]),
      [135, 125, 85, 110],
    );
    note(doc, siteContent.reports.behaviourFootnote);
  }

  doc.end();
  await finished(output);
}

function sectionHeading(doc: PDFKit.PDFDocument, title: string) {
  doc.moveDown(0.4);
  doc.font("Plex").fontSize(13).fillColor("#0b1512").text(title);
  doc.moveDown(0.55);
}

function drawTable(doc: PDFKit.PDFDocument, headings: string[], rows: string[][], widths: number[]) {
  const left = 48;
  const rowHeight = 29;
  doc.font("Plex").fontSize(8).fillColor("#ffffff");
  doc.rect(left, doc.y, widths.reduce((sum, width) => sum + width, 0), rowHeight).fill("#0c2f26");
  const headerY = doc.y + 9;
  let x = left + 8;
  headings.forEach((heading, index) => {
    doc.font("Plex").fontSize(8).fillColor("#ffffff").text(heading, x, headerY, { width: widths[index] - 12 });
    x += widths[index];
  });
  doc.y += rowHeight;

  rows.forEach((row, rowIndex) => {
    const y = doc.y;
    if (rowIndex % 2 === 0) doc.rect(left, y, widths.reduce((sum, width) => sum + width, 0), rowHeight).fill("#f5f6f4");
    x = left + 8;
    row.forEach((value, index) => {
      doc.font("Plex").fontSize(8).fillColor("#26332d").text(value, x, y + 9, {
        width: widths[index] - 12,
        height: rowHeight - 10,
        ellipsis: true,
      });
      x += widths[index];
    });
    doc.y += rowHeight;
  });
  doc.moveDown(0.45);
}

function note(doc: PDFKit.PDFDocument, text: string) {
  doc.moveDown(0.4);
  doc.font("Plex").fontSize(8).fillColor("#64716a").text(text, { lineGap: 3 });
}

async function main() {
  await fs.mkdir(outputDirectory, { recursive: true });
  await Promise.all(reportFiles.map((_, index) => renderReport(index)));
  console.log(`Built ${reportFiles.length} sample reports in ${outputDirectory}`);
}

main().catch((error: unknown) => {
  console.error("Failed to build sample reports:", error);
  process.exitCode = 1;
});
