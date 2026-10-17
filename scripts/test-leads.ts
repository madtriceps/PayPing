import { NextRequest } from "next/server";
import { POST } from "../src/app/api/leads/route";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const lead = {
  name: "Test Lead",
  businessName: "Test Business",
  phone: "",
  email: "test@example.test",
  monthlyInvoices: "50-200",
  persona: "chartered accountant",
  message: "Please send details.",
  source: "book-demo",
  website: "",
};

async function runCase(webhookRejects: boolean) {
  const requests: Array<{ url: string; body: string }> = [];
  globalThis.fetch = async (input, init) => {
    const url = String(input);
    const body = typeof init?.body === "string" ? init.body : "";
    requests.push({ url, body });
    if (url === "https://sheet.example.test/exec") {
      return new Response(JSON.stringify({ ok: !webhookRejects }), { status: 200 });
    }
    if (url === "https://api.resend.com/emails") {
      return new Response(JSON.stringify({ id: "email_test" }), { status: 200 });
    }
    throw new Error(`Unexpected outbound request to ${url}`);
  };

  const request = new NextRequest("http://localhost/api/leads", {
    method: "POST",
    headers: { "content-type": "application/json", "x-real-ip": webhookRejects ? "192.0.2.2" : "192.0.2.1" },
    body: JSON.stringify(lead),
  });
  const response = await POST(request);
  assert(response.status === 201, `Expected success, got HTTP ${response.status}.`);
  const sheetRequest = requests.find((item) => item.url === "https://sheet.example.test/exec");
  const emailRequest = requests.find((item) => item.url === "https://api.resend.com/emails");
  assert(sheetRequest, "Expected an Apps Script request.");
  assert(emailRequest, "Expected a Resend notification even when the sheet succeeds.");

  const submittedLead = JSON.parse(sheetRequest.body) as Record<string, unknown>;
  assert(submittedLead.secret === "test-sheet-secret", "The sheet secret was not included.");
  assert(submittedLead.persona === lead.persona, "The audience was not included.");
  assert(typeof submittedLead.createdAt === "string", "The submission timestamp was not included.");
  if (webhookRejects) {
    const email = JSON.parse(emailRequest.body) as { text: string };
    assert(email.text.includes(lead.email), "The fallback email did not include the lead details.");
    assert(email.text.includes(lead.businessName), "The fallback email did not include the business name.");
  }
}

async function main() {
  delete process.env.DATABASE_URL;
  delete process.env.DIRECT_URL;
  delete process.env.REDIS_URL;
  process.env.LEADS_SHEET_WEBHOOK_URL = "https://sheet.example.test/exec";
  process.env.LEADS_SHEET_SECRET = "test-sheet-secret";
  process.env.RESEND_API_KEY = "re_test";
  process.env.LEAD_NOTIFY_EMAIL = "team@example.test";
  process.env.RESEND_FROM = "PayPing <noreply@example.test>";

  const originalFetch = globalThis.fetch;
  try {
    await runCase(false);
    console.log("PASS: webhook success stores the lead and sends the configured email without database or Redis.");
    await runCase(true);
    console.log("PASS: webhook rejection falls back to Resend and still confirms the request.");
  } finally {
    globalThis.fetch = originalFetch;
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
