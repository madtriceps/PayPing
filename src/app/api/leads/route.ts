import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const leadSchema = z.object({
  name: z.string().trim().min(1).max(100),
  businessName: z.string().trim().min(1).max(120),
  phone: z.string().trim().max(30).optional(),
  email: z.email().trim().max(254),
  monthlyInvoices: z.enum(["<50", "50-200", "200-1000", "1000+"]),
  persona: z.enum(["business owner", "chartered accountant", "investor or partner", "other"]),
  message: z.string().trim().max(2000).optional(),
  source: z.literal("book-demo"),
  website: z.string().max(0).optional(),
});

const attemptsByIp = new Map<string, number[]>();
const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 5;

function isRateLimited(ip: string, now: number) {
  const attempts = (attemptsByIp.get(ip) ?? []).filter((time) => now - time < WINDOW_MS);
  if (attempts.length >= MAX_ATTEMPTS) {
    attemptsByIp.set(ip, attempts);
    return true;
  }
  attempts.push(now);
  attemptsByIp.set(ip, attempts);
  if (attemptsByIp.size > 5000) {
    for (const [key, values] of attemptsByIp) {
      const recent = values.filter((time) => now - time < WINDOW_MS);
      if (recent.length) attemptsByIp.set(key, recent);
      else attemptsByIp.delete(key);
    }
  }
  return false;
}

type LeadSubmission = z.infer<typeof leadSchema>;

function configuredForResend() {
  return Boolean(process.env.RESEND_API_KEY && process.env.LEAD_NOTIFY_EMAIL && process.env.RESEND_FROM);
}

async function sendLeadNotification(lead: LeadSubmission & { createdAt: string }) {
  const apiKey = process.env.RESEND_API_KEY;
  const recipient = process.env.LEAD_NOTIFY_EMAIL;
  const sender = process.env.RESEND_FROM;
  if (!apiKey || !recipient || !sender) return false;

  const lines = [
    `Name: ${lead.name}`,
    `Business: ${lead.businessName}`,
    `Email: ${lead.email}`,
    `Phone: ${lead.phone || "Not provided"}`,
    `Monthly invoices: ${lead.monthlyInvoices}`,
    `I am a: ${lead.persona}`,
    `Message: ${lead.message || "Not provided"}`,
    `Source: ${lead.source}`,
    `Received: ${lead.createdAt}`,
  ];
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      from: sender,
      to: [recipient],
      subject: "New PayPing demo request",
      text: lines.join("\n"),
    }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) {
    throw new Error(`Resend returned HTTP ${response.status}: ${(await response.text()).slice(0, 300)}`);
  }
  return true;
}

export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-real-ip") ?? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (isRateLimited(ip, Date.now())) {
    return NextResponse.json({ error: "We’ve had a few requests from this connection. Please try again in a little while." }, { status: 429 });
  }

  let submitted: unknown;
  try {
    submitted = await request.json();
  } catch {
    return NextResponse.json({ error: "Please check the form and try again." }, { status: 400 });
  }

  const parsed = leadSchema.safeParse(submitted);
  if (!parsed.success) {
    return NextResponse.json({ error: "Please check the details and try again." }, { status: 400 });
  }
  if (parsed.data.website) {
    return NextResponse.json({ error: "Please check the details and try again." }, { status: 400 });
  }

  const lead = {
    ...parsed.data,
    email: parsed.data.email.toLowerCase(),
    monthlyInvoices: parsed.data.monthlyInvoices,
    persona: parsed.data.persona,
    createdAt: new Date().toISOString(),
  };
  const sheetUrl = process.env.LEADS_SHEET_WEBHOOK_URL;
  const sheetSecret = process.env.LEADS_SHEET_SECRET;
  const sheetConfigured = Boolean(sheetUrl && sheetSecret);
  const resendConfigured = configuredForResend();
  if (!sheetConfigured && !resendConfigured) {
    console.error("Lead delivery is not configured. Set the Apps Script webhook or Resend environment variables.");
    return NextResponse.json({ error: "We can’t receive demo requests just now. Please try again later." }, { status: 503 });
  }

  let sheetSaved = false;
  if (sheetConfigured && sheetUrl && sheetSecret) {
    try {
      const response = await fetch(sheetUrl, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ secret: sheetSecret, ...lead }),
        signal: AbortSignal.timeout(10_000),
      });
      const responseBody = await response.text();
      if (!response.ok) {
        throw new Error(`Apps Script returned HTTP ${response.status}: ${responseBody.slice(0, 300)}`);
      }
      if (responseBody.trim()) {
        try {
          const result: unknown = JSON.parse(responseBody);
          if (typeof result === "object" && result !== null && "ok" in result && result.ok !== true) {
            throw new Error("Apps Script rejected the secret or did not save the lead.");
          }
        } catch (error) {
          if (error instanceof SyntaxError) {
            throw new Error("Apps Script returned a non-JSON response.");
          }
          throw error;
        }
      }
      sheetSaved = true;
    } catch (error) {
      console.error("Lead Apps Script delivery failed.", error);
    }
  } else if (sheetUrl || sheetSecret) {
    console.error("Lead Apps Script delivery is incomplete. Both LEADS_SHEET_WEBHOOK_URL and LEADS_SHEET_SECRET are required.");
  }

  let emailSent = false;
  if (resendConfigured) {
    try {
      emailSent = await sendLeadNotification(lead);
    } catch (error) {
      console.error("Lead Resend notification failed.", error);
    }
  } else if (
    process.env.RESEND_API_KEY || process.env.LEAD_NOTIFY_EMAIL || process.env.RESEND_FROM
  ) {
    console.error("Lead Resend notification is incomplete. RESEND_API_KEY, LEAD_NOTIFY_EMAIL, and RESEND_FROM are required.");
  }

  if (sheetSaved || emailSent) {
    return NextResponse.json({ ok: true }, { status: 201 });
  }
  return NextResponse.json(
    { error: "We couldn’t save your note just now. Please try again." },
    { status: 503 },
  );
}
