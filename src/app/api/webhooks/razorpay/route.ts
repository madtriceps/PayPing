import { handleRazorpayWebhook } from "@/lib/webhooks/razorpay";

export const runtime = "nodejs";

export async function POST(request: Request) {
  return handleRazorpayWebhook(request);
}
