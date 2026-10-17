# PayPing

**Get paid. Don't chase.**

PayPing is an early-access invoice follow-up product concept for businesses that want to collect receivables with less manual chasing. It brings invoice reminders, payment status, and follow-up history into one workflow, with a clear promise: stop reminders when payment is confirmed.

This repository contains the public product site and a runnable local demo. The demo includes both a browser-only product walkthrough and a seeded application backed by PostgreSQL and Redis.

> **Demo only.** WhatsApp delivery and payment processing are simulated. Do not enter real customer, invoice, or payment information. This project is not ready for production use with real accounts or funds.

## See PayPing

| Experience | Local URL | What it shows |
| --- | --- | --- |
| Product site | [http://127.0.0.1:3000](http://127.0.0.1:3000) | Product story, resources, and early-access booking |
| Guided demo | [http://127.0.0.1:3000/demo](http://127.0.0.1:3000/demo) | A self-contained, browser-only product walkthrough |
| Live application demo | [http://127.0.0.1:3000/demo/live](http://127.0.0.1:3000/demo/live) | Seeded dashboard, invoices, reminders, and phone simulator |
| Client directory | [http://127.0.0.1:3000/demo/clients](http://127.0.0.1:3000/demo/clients) | Sample client payment histories and collections insights |

## Start the local demo

### Requirements

- Node.js 20 or newer and npm
- Docker Desktop with its engine running

From the repository root, run:

```powershell
npm install
npm run demo
```

The first run creates `.env` from `.env.example` when needed, starts PostgreSQL and Redis, syncs the Prisma schema, seeds the demo organization and invoices, builds the site, then starts the production web server and reminder worker.

Open [http://127.0.0.1:3000](http://127.0.0.1:3000). The guided demo works without the database or Redis; the live application demo uses both. Use the terminal running `npm run demo` and press **Ctrl+C** to stop the web server and worker. Docker volumes persist after the app stops.

The demo binds to `127.0.0.1` and is intended for this computer, not as a public deployment. It uses local demo adapters and does not require Meta, Razorpay, Google Sheets, or Resend credentials.

### Run the parts separately

For troubleshooting or development, the underlying steps are also available as npm scripts:

```powershell
npm run db:up
npm run db:push
npm run db:seed
npm run build
npm run start
```

Run the reminder worker in a second terminal:

```powershell
npm run worker
```

For active code changes, use `npm run demo:dev`. Development mode is not the recommended way to present the demo.

## Take the product tour

1. Start with `/demo` for an interactive walkthrough that stays in the browser. Its sample CSV is processed locally and is not uploaded to the application API.
2. Open `/demo/live` to explore the seeded invoices and the simulated WhatsApp conversation panel.
3. Watch the worker terminal for rendered demo messages. With `DEMO_TIME_COMPRESSION=true`, reminder jobs are scheduled on a short, accelerated timeline.
4. Open an invoice payment link and choose **Pay now (demo)**. This sends a signed fake payment event through the webhook route, marks the invoice paid, cancels its outstanding reminders, and records a thank-you message. No payment is taken.
5. In the phone simulator, choose a client and select **Already Paid? Tap to Pause**. The demo webhook marks the invoice **Pending Verification** and pauses its reminders.
6. On the dashboard, reject the claim to resume reminders.
7. Try uploading the sample receivables file at `samples/invoices.csv`. Duplicate invoice numbers are skipped.

## Product experience

The site is designed around a calm, readable collections workflow:

- A responsive product site, early-access booking form, privacy and terms pages, and guides and sample reports.
- A browser-only walkthrough for trying the story without connecting to backend services.
- A seeded invoice dashboard with client and invoice views, search and status filters, collections insights, reminder schedules, and invoice activity.
- A WhatsApp-style simulator that displays persisted outbound messages and payment confirmations.
- An accelerated reminder queue for observing dispatch, follow-up, payment, and cancellation in a short local demo.
- Reduced-motion and mobile-friendly presentations of the guided story.

Marketing copy, product claims, FAQs, message templates, sample fixtures, and resource content are maintained in [`src/content/site.ts`](./src/content/site.ts).

## How the demo is put together

```text
Browser
  ├─ Public site and guided walkthrough
  ├─ Live invoice dashboard and phone simulator
  └─ Local payment checkout
       │
Next.js App Router
  ├─ Invoice upload and dashboard APIs
  ├─ Razorpay-shaped and Meta-shaped demo webhook handlers
  └─ Shared payment reconciliation
       ├─ PostgreSQL · Prisma models and message history
       └─ Redis · BullMQ reminder queue
             └─ Long-running reminder worker
```

- **Money:** stored as integer paise; formatted as Indian rupees for display.
- **Invoice idempotency:** an organization and invoice-number uniqueness constraint prevents duplicate imports.
- **Reminder reliability:** scheduled reminders are represented in both Redis jobs and database records. The worker checks invoice state before sending, and queue reconciliation can restore missing jobs.
- **Payment safety in the demo:** the shared payment handler is idempotent, marks the invoice paid, cancels future reminders, and records a thank-you. The local checkout uses a fake signed event and never contacts a gateway.
- **Message history:** outbound demo messages are logged so the simulator can render the conversation.
- **Lead handling:** `/book-demo` posts to a configured Apps Script endpoint and can notify a team inbox through Resend. Setup is documented in [`docs/leads-sheet-setup.md`](./docs/leads-sheet-setup.md).

### What is real and what is simulated

| Capability | Local demo behavior |
| --- | --- |
| Invoice and client records | Stored in local PostgreSQL through Prisma |
| Reminder jobs and worker | BullMQ on local Redis |
| WhatsApp messages | Simulated; rendered message content is logged, not sent to Meta |
| Payment links | Local `/pay/<invoiceId>` checkout |
| Payment capture | Fake signed event through the demo webhook; no charge is made |
| “Already Paid” reply | Fake button-reply event through the demo webhook |
| Booking form delivery | Apps Script and optional Resend, when configured |
| Real provider accounts, live customer messaging, and payment collection | Not implemented |

## Configuration

The defaults in `.env.example` are for a local demo. `npm run demo` creates `.env` from that file if one does not exist.

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL`, `DIRECT_URL` | Local PostgreSQL connection |
| `REDIS_URL` | Local BullMQ connection |
| `DEMO_MODE` | Uses non-production provider adapters |
| `DEMO_TIME_COMPRESSION` | Shortens reminder timing for the walkthrough |
| `DEMO_WEBHOOK_SECRET` | Signs fake payment events in demo mode |
| `META_WEBHOOK_VERIFY_TOKEN` | Local Meta-shaped webhook handshake |
| `DEMO_BASE_URL`, `NEXT_PUBLIC_APP_URL` | Local app URLs used by E2E and demo links |
| `CONTACT_EMAIL` | Role inbox displayed on the public site |
| `LEADS_SHEET_WEBHOOK_URL`, `LEADS_SHEET_SECRET` | Optional lead-to-Sheets delivery |
| `RESEND_API_KEY`, `LEAD_NOTIFY_EMAIL`, `RESEND_FROM` | Optional lead notification email |

Never commit credentials or replace the demo adapters with live provider credentials in an unauthenticated environment. Lead delivery setup and failure behavior are described in [`docs/leads-sheet-setup.md`](./docs/leads-sheet-setup.md).

## Quality checks

Run focused checks from the repository root:

```powershell
npm run typecheck
npm run test:insights
npm run verify:insights
npm run verify:schedule
npm run test:leads
npm run build
```

The full demo E2E test requires the local app and worker, plus the demo database and Redis:

```powershell
npm run e2e:demo
```

It verifies CSV upload and initial dispatch, payment webhook idempotency, thank-you delivery, claim pause/resume, and compressed reminder behavior. Successful E2E runs remove their own test invoices.

## Project map

| Path | Responsibility |
| --- | --- |
| `src/app/` | Public routes, dashboard, checkout, and API handlers |
| `src/components/story/` | Landing-page scroll story and dashboard preview |
| `src/content/site.ts` | Central product and marketing content |
| `src/lib/queue/` | BullMQ connection, queue, scheduling, and job types |
| `src/lib/payments.ts` | Shared invoice payment reconciliation |
| `src/lib/webhooks/` | Demo/provider webhook parsing and verification |
| `src/workers/` | Long-running reminder worker entry point |
| `prisma/schema.prisma` | Database schema and constraints |
| `prisma/seed.ts` | Repeatable local demo data |
| `scripts/e2e-demo.ts` | End-to-end demo verification |
| `design/review/` | Responsive design and scroll-story review captures |

## Product and security boundaries

This is an early-access demo, not a production collections platform. The seeded dashboard has no user authentication and must only contain sample data. Real Meta messaging, real Razorpay transactions, account management, authorization, production data retention, and deployment hardening are outside the current demo. Keep `DEMO_MODE=true` for local use and do not expose the backend demo to customer data or the public internet.
