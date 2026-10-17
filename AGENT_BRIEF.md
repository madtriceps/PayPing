# PayPing – Autopilot Brief: working demo + public site

## DECISIONS ALREADY MADE (do not ask about these)
- Credentials: env vars only; DEMO_MODE=true needs none. No credentials UI, no live Meta/Razorpay in this brief.
- Contact: /book-demo is the ONLY contact path. No /contact page, no phone/WhatsApp/LinkedIn/founder name anywhere. Footer shows only the role email from env CONTACT_EMAIL.
- Leads: stored in a Google Sheet via an Apps Script webhook, plus a Resend notification email. The public site must build and run with NO database and NO Redis.
- No fake testimonials, customer logos, or statistics anywhere.
- All marketing copy, pricing numbers, FAQ answers and report/template text live in ONE file, `src/content/site.ts`, so I can edit it without touching components. Values I must confirm are marked `// CONFIRM`.
- Header CTA label is "Book a walkthrough" (route stays /book-demo). "Live demo" means the self-serve /demo only.
- Do not ask me questions; choose the simplest option and record it in PROGRESS.md.

Phases in this brief: 1 demo, 2 phone simulator, 2.5 collections insights + tabs, 2.7 the guided demo page (spec in DEMO_PAGE_SPEC.md, highest priority), 3 brand and design system, 4 public site, 4b resources and sample reports, 4c scroll choreography, 5 leads, 6 Vercel readiness. Do them in order.


You are continuing an existing codebase in this folder (Prisma schema + BullMQ queue + worker, written but never compiled).
GOAL OF THIS BRIEF: a demo that runs locally with 3 commands and shows the full loop end to end. Keep it SIMPLE. No auth, no polish, no extra features.

## PHASE 1 – Working local demo (Steps 0-4 below)

## Operating rules
1. Work strictly in the steps below, in order. After each step run its VERIFY commands. Do not start the next step until they pass. If something fails, fix and re-run; don't skip.
2. Keep a running `PROGRESS.md`: step done, commands run, results, any decision you made.
3. Do not add anything not listed (no auth, no UI libraries beyond Tailwind, no credentials UI, no S3, no PDF generation).
4. Prefer deleting complexity to adding it. If a listed file is overkill for the demo, simplify it, and note that in PROGRESS.md.
5. When Phase 1 steps pass, continue to Phase 2 and onward. Print the "DEMO RUNBOOK" only at the very end (after Phase 6). Never start anything listed under "LATER".

## STEP 0 – Make the project exist and compile
- Create `package.json` (Next.js 14+ App Router, TypeScript, Tailwind). Deps: `next react react-dom @prisma/client bullmq ioredis date-fns date-fns-tz zod papaparse razorpay` ; dev: `prisma typescript tsx @types/node @types/react @types/papaparse tailwindcss postcss autoprefixer`.
- Add `tsconfig.json` with path alias `@/*` -> `src/*`.
- Add `docker-compose.yml` with Postgres 16 and Redis 7 (no cloud accounts needed). Set `.env` from `.env.example` pointing at them (`DIRECT_URL` = `DATABASE_URL` locally).
- Create `src/lib/prisma.ts` (standard singleton client).
- FIX KNOWN BUG: in `src/workers/reminder.worker.ts` the job handler is named `process`, which shadows Node's global `process` (breaks `process.env` and `process.on`). Rename it `processReminder` and update the Worker constructor.
- Replace the `require.main === module` start check with a dedicated entry file `src/workers/start.ts` that calls `startReminderWorker()`. Run it with `tsx`.
- Add npm scripts: `dev` (next), `worker` (`tsx src/workers/start.ts`), `db:up` (docker compose up -d), `db:push` (prisma db push), `db:seed`, `typecheck` (tsc --noEmit).
VERIFY: `docker compose up -d` ok; `npx prisma validate` ok; `npx prisma db push` ok; `npm run typecheck` has zero errors.

## STEP 1 – DEMO_MODE adapters (no external accounts needed)
Add env `DEMO_MODE=true`. In demo mode:
- `src/lib/whatsapp/index.ts` exports `whatsappSender`. Demo implementation: does NOT call Meta; logs the rendered message to console and returns a fake `waMessageId` (`demo_<uuid>`). Real Meta implementation can be a stub that throws "not implemented (LATER)".
- `src/lib/razorpay/payment-link.ts` exports `ensurePaymentLink(invoiceId)`. Demo implementation: returns `http://localhost:3000/pay/<invoiceId>` and stores it in `rzpShortUrl`. Idempotent (reuse if already set).
- `src/app/pay/[invoiceId]/page.tsx`: a tiny fake checkout page with a "Pay now" button that POSTs to the same internal handler the real Razorpay webhook will use (see Step 3).
- Add env `DEMO_TIME_COMPRESSION=true`: in `computeRunAt` / `scheduleInvoiceSequence`, when enabled, schedule the 3 reminders at +20s, +40s, +60s from now instead of real dates, so the whole sequence is watchable in about a minute. The real date logic must remain the default when the flag is off.
VERIFY: unit-level script or test that calls `scheduleInvoiceSequence` on a seeded invoice with compression on and shows 4 jobs in the queue with the expected delays.

## STEP 2 – Seed + CSV upload + dashboard (the only UI)
- `prisma/seed.ts`: create one org ("Demo Distributors", tz Asia/Kolkata). No login; all API/UI uses this org (look it up by a constant). Mark clearly in code: `// LATER: replace with real auth`.
- `POST /api/invoices/upload` (multipart CSV only; skip Excel for now). Fixed expected headers: `client_name, client_phone, invoice_number, amount, due_date`. Skip the column-mapping UI. Validate with zod; normalize phone to E.164 (default +91); amount rupees -> paise; due_date `YYYY-MM-DD`. Upsert client; create invoice (skip duplicates by org+invoiceNumber and report them); then call `scheduleInvoiceSequence` for each new invoice. Return `{created, skipped, errors[]}`.
- Provide `samples/invoices.csv` with 5 rows (due dates: today+1, today+3, today+5, one already overdue, one far future).
- Page `/` (single page): file drop/choose zone + invoices table (client, invoice #, amount in ₹, due date, status badge for PENDING / REMINDER_ACTIVE / PENDING_VERIFICATION / PAID / FAILED, and a "next reminder" column from ReminderSchedule). Auto-refresh every 3s (simple polling is fine). Highlight PENDING_VERIFICATION rows. Add per-row buttons: "Mark paid" and "Reject claim" (the latter only for PENDING_VERIFICATION, calls `resumeInvoiceReminders`).
VERIFY: `npm run dev` + `npm run worker`; upload the sample CSV; table shows 5 rows moving PENDING -> REMINDER_ACTIVE and console shows the rendered demo WhatsApp messages.

## STEP 3 – Reconciliation (the core promise)
Create ONE shared function `markInvoicePaid(invoiceId, {amountPaise, source, paymentId})` in `src/lib/payments.ts`: in a transaction set status PAID, paidAt, paidSource, paidAmountPaise; then `cancelInvoiceReminders(id,"PAID")`; then send the thank-you through `whatsappSender` (template `THANKS`). It must be idempotent (second call does nothing) and must not downgrade an already PAID invoice.
- `POST /api/webhooks/razorpay`: read RAW body, verify `x-razorpay-signature` (HMAC SHA256) using `RAZORPAY_WEBHOOK_SECRET`; in DEMO_MODE accept a fixed demo secret. Idempotency via `WebhookEvent` (provider+`x-razorpay-event-id`). Handle `payment.captured` only, find the invoice via payment link id / `reference_id` = invoiceId, call `markInvoicePaid`. Always return 200 quickly for already-processed events.
- `src/app/pay/[invoiceId]` "Pay now" button calls an internal route that builds a signed fake `payment.captured` payload and posts it to the webhook route above (so the demo exercises the REAL webhook path).
- `POST /api/webhooks/meta` (+ GET verify handshake using `META_WEBHOOK_VERIFY_TOKEN`): handle a button reply whose payload is `PAID_CLAIM:<invoiceId>` -> set status PENDING_VERIFICATION, set `claimedPaidAt`, `cancelInvoiceReminders(id,"PENDING_VERIFICATION")`. Skip Meta signature verification only when DEMO_MODE=true (leave a TODO for LATER).
- Add a demo-only button/endpoint "Simulate 'Already Paid' tap" per row that calls the same handler with a fake Meta payload.
VERIFY (automated script `scripts/e2e-demo.ts`, exit non-zero on failure):
  a) upload CSV -> 5 invoices, initial dispatch logged for each
  b) pay invoice A via the webhook -> status PAID, its remaining jobs gone from the queue, a thank-you logged, and NO further reminders fire for it
  c) simulate "Already Paid" on invoice B -> PENDING_VERIFICATION and reminders stop
  d) send the same payment webhook twice -> only one thank-you
  e) untouched invoice C still receives all 3 reminders (compressed timing)

## STEP 4 – Demo polish (minimal)
- `npm run demo` script: `db:up`, `db:push`, `db:seed`, then run next dev + worker together (concurrently).
- `README.md` replaced with a DEMO RUNBOOK: prerequisites (Node 20, Docker), the commands, the 6-step click-through for a live demo, and a short "What is real vs mocked" table (WhatsApp send, payment link, auth, PDF, Excel upload = mocked/deferred).

## DEFINITION OF DONE
Fresh clone -> `npm i && npm run demo` -> open localhost:3000 -> upload sample CSV -> watch statuses change, see reminders logged within about a minute -> click "Pay now" on one invoice and it flips to PAID and stops -> click "Simulate Already Paid" on another and it flips to Pending Verification and stops. `npm run typecheck` and `scripts/e2e-demo.ts` both pass.

---
## PHASE 2 – Phone simulator
A panel on the dashboard styled like a client's phone (small muted label "Preview of client's phone"). Pick a client, show a WhatsApp-style chat of their MessageLog (add MessageLog.body), including the payment link (opens /pay/<invoiceId>) and a clickable "Already Paid? Tap to Pause" button that calls the real Meta webhook handler. Show the thank-you bubble after payment. Header indicator "Time compression on".
VERIFY: typecheck; upload sample CSV; bubbles appear live; tapping the button flips the invoice to PENDING_VERIFICATION.

## PHASE 2.5 – Collections insights (read-only, no schema changes)
Uses existing fields only: Invoice.dueDate, paidAt, amountPaise, status.

Seed: extend prisma/seed.ts with ~8 demo clients, each with 2-4 historical PAID invoices (paidAt = dueDate + varied offsets from -3 to +25 days) and a couple of open invoices. Mark it clearly in code as demo history.

Metrics per client (`src/lib/insights.ts`, pure functions, unit-tested):
- outstandingPaise and openInvoiceCount (status PENDING, REMINDER_ACTIVE, PENDING_VERIFICATION)
- maxDaysOverdue across open invoices
- paidCount, avgDaysLate (mean of paidAt - dueDate in days; negative = early), onTimeRate (share paid on or before due date)
- reliability label ONLY if paidCount >= 3: "Usually on time" (onTimeRate >= 0.8), "Sometimes late" (0.5 to 0.8), "Often late" (< 0.5). Otherwise "Not enough history". Always show "Based on N invoices".
- No numeric score and no words like "bad" or "risky". Neutral wording, e.g. "Pays 9 days late on average".

UI:
- On the dashboard, above the invoices table, a row of four compact lists (top 5 each): "Needs attention today" (overdue open invoices ranked by amountPaise * daysOverdue), "Biggest outstanding", "Slowest payers", "Most reliable". Each row is clickable.
- `/demo/clients` page: searchable, sortable table (outstanding, avg days late, on-time rate, last payment date) with filter chips (Overdue, Has pending verification, Not enough history).
- Client side panel: open invoices, payment history timeline, avg delay, on-time rate with N shown.
- Empty states in plain warm language, e.g. "Nothing to chase today."
Invoice tabs (above the invoices table): All; Needs your approval (PENDING_VERIFICATION, listed first, highlighted count); Active (PENDING + REMINDER_ACTIVE); Overdue (open invoices with dueDate < today, may overlap Active); Paid; Failed (only shown when count > 0). Count on every tab, selection kept in the URL (?tab=), search and sort work within a tab. In "Needs your approval" each row has "Confirm paid" (markInvoicePaid) and "Not paid yet" (resumeInvoiceReminders). Friendly empty states, e.g. "Nothing waiting on you."
Use existing styling. Do not change reminder or webhook logic.
VERIFY: tab counts match the data after upload, a payment and an Already Paid tap; unit tests for insights.ts including the paidCount < 3 case and early payments; typecheck; e2e-demo.ts still passes.

## PHASE 2.7 – THE GUIDED DEMO PAGE (highest-priority deliverable)
Read and execute `DEMO_PAGE_SPEC.md` in full, Commands 1 to 10, in order, before Phase 3. It runs entirely in the browser with a virtual clock (no Redis, DB, worker, Meta or Razorpay), shares pure engine code with the backend, supports "use my own file" with nothing leaving the browser, and ends in a call-back request. `/demo` = this guided simulation; the backend-driven dashboard moves to `/demo/live`. Phase 3 styling applies to it afterwards.
VERIFY: everything listed in the spec's Definition of Done.

## PHASE 3 – Brand and design system (this is where the page gets its soul)

### Concept: "the ripple that stops"
PayPing's whole promise is that the pinging stops the moment someone pays. Make that the visual identity, not a decoration.
- **The ping motif:** a solid dot with one or two concentric rings. WAITING state: rings emit slowly outward (about 2.4s, ease-out, opacity 0.5 to 0). PAID state: one ring closes into a check mark in emerald with a small spring, then everything goes still. Build it once as `<PingMark state="waiting|paid|paused" />` and use it everywhere: logo, favicon, status indicators in the invoice table (unpaid rows pulse softly, paid rows are still), loaders, section dividers (a dot travels along a thin line as you scroll), and very faint rings behind the hero phone.
- **Voice:** warm, plain, human, a little dry. No exclamation marks; never "supercharge", "seamless", "revolutionize".

### Visual system
- Rhythm: alternate DARK and LIGHT sections like a product keynote (dark hero, light explanation, dark "promise" section, light proof, dark closing). Dark = ink gradient below; light = canvas #F5F6F4.
- Tokens: canvas #F5F6F4, surface #FFFFFF, hairline #E6E8E4, ink #0B1512, emerald #0E8F6B (bright #19C48A), saffron #E8A33D, coral #D95C54, pending-verification tint #FFF6E5. Dark hero: linear-gradient(135deg,#07110E 0%,#0C2F26 55%,#11553F 100%), one radial #19C48A glow at 18% opacity, 3% noise. Primary button gradient #12A07A to #0E8F6B; everything else flat.
- Type via next/font: display = Instrument Serif (regular + italic) for headlines, with ONE italic emphasised phrase per headline (e.g. "Get paid. *Don't chase.*"); UI/body = Geist (fallback Inter Tight); all numbers tabular. Very large hero type (clamp to ~96px desktop), tight leading, generous whitespace. Rupee amounts use Indian grouping (₹12,50,000).
- Icons: hand-built inline SVG set in `src/components/icons/`: 24px grid, 1.75 stroke, round caps and joins, each icon carries a small ring/dot detail from the ping motif. Needed: Upload, Send, Reminder, Paid, Pause, Client, Overdue, Report, Link, Shield, Clock, Chart. lucide-react is allowed only for plain utility glyphs (chevron, close, menu). Never emoji.
- Motion (`motion` library allowed): spring micro-interactions 150-250ms; section reveals on scroll; rupee numbers count up once; list re-sorting uses layout animation (FLIP); the "paid" moment gets the ring-closes-into-check animation. Everything respects prefers-reduced-motion (falls back to static) and never blocks interaction.
- Dashboard (same system): dark hero stats strip with large white tabular numerals and an emerald ₹; status as PingMark + plain label (no loud pills); relative due dates ("in 3 days", "2 days overdue") with exact date on hover; row click opens a side panel with the invoice timeline; the phone simulator sits on a dark surface.
- Forbidden: purple/blue gradients, gradient text, glassmorphism, neon glows, gradient cards, emoji icons, generic 3-equal-cards feature grids, stock illustrations, centered-everything layouts, default shadcn look.

### Elevation and depth (one system, used everywhere)
Define CSS tokens once in the global stylesheet and use ONLY these. Three levels, light source from above (y offset positive, x = 0), shadows tinted with the ink hue (11,21,18), never pure black or grey.
- `--shadow-rest`: `0 1px 2px rgba(11,21,18,.06), 0 1px 1px rgba(11,21,18,.04)` (cards, inputs; usually paired with the 1px hairline).
- `--shadow-raised`: `0 2px 4px rgba(11,21,18,.05), 0 8px 16px -4px rgba(11,21,18,.08)` (hover states, popovers, menus).
- `--shadow-float`: `0 4px 8px rgba(11,21,18,.04), 0 16px 32px -8px rgba(11,21,18,.12), 0 32px 64px -16px rgba(11,21,18,.14)` (coach card, call-back drawer, dashboard "screen" on light backgrounds).
- Device shadow for the hero phone and dashboard screen on the dark stage: `0 24px 48px -12px rgba(0,0,0,.45), 0 60px 120px -30px rgba(0,0,0,.55)` plus a soft elliptical contact shadow on the "floor" beneath the phone (blurred ellipse, ~35% opacity).
- On DARK surfaces, shadows barely show, so express elevation by lighter fills (each level slightly lighter), `inset 0 1px 0 rgba(255,255,255,.08)` top edge, and a `1px solid rgba(255,255,255,.06)` border. The dashboard screen gets ONE faint emerald under-glow (`#19C48A` at about 14% opacity, large blur). This is the only glow allowed.
- Primary button: `0 6px 16px -6px rgba(14,143,107,.5)`.
Rules: at most 3 elevation levels visible at once; no shadows on table rows or on cards inside cards; no shadows on text; sticky header uses a hairline, adding a raised shadow only after scrolling; never neumorphism.
Layering order (back to front): stage background, ambient ping rings, dashboard screen, phone (overlaps the dashboard's edge by about 48px on desktop), coach card, drawers, toasts. On scroll the phone moves slightly faster than the dashboard (about 1.1x) in the hero and Stage B.
Performance: never animate `box-shadow`. Put the shadow on a pseudo-element and animate its opacity and scale (the shadow grows softer as the phone lifts, tighter as it lands). Reduced motion: static shadows.
VERIFY: tokens exist in one place and no component hardcodes a shadow; review screenshots show clear depth on both the light and dark stages.

### Reference + review loop (do this, don't skip)
1. If `design/references/` contains screenshots, study them FIRST and write `design/NOTES.md`: for each, one principle you are taking (layout idea, pacing, motion, density), never copying visuals. If the folder is empty, proceed from this brief.
2. After building each major section, use Playwright (`npx playwright`) to screenshot at 1440x900 and 390x844 into `design/review/`, look at them, and critique against this checklist: (a) can a stranger explain the product after 5 seconds? (b) is there one memorable visual moment per screen? (c) any generic card grid or template feel? (d) is hierarchy obvious at a glance (one dominant element per screen)? (e) contrast and legibility? (f) does the ping motif appear without being forced? Fix what fails; at most 2 rounds per section; log what changed in PROGRESS.md.
VERIFY: typecheck; e2e-demo.ts passes; screenshots exist for every section at both widths.

## PHASE 4 – Public site (single scrolling page + a few real pages)
Routes: / (landing), /demo (the guided demo from Phase 2.7, "Live demo" badge), /demo/live (backend dashboard, local only), /demo/clients, /resources (Phase 4b), /book-demo, /privacy, /terms.

**Header** (solid background, hairline on scroll, no blur): logo (PingMark + wordmark), anchors on `/`: Product, How it works, Reports (links to /resources), Pricing, FAQ; right side: "Live demo" text link and primary button "Book a walkthrough". Mobile: full-screen menu sheet with large type.

**Landing sections** (all copy from `src/content/site.ts`):
1. **Hero (dark).** Headline "Get paid. *Don't chase.*" Subline "PayPing sends your invoices on WhatsApp, follows up politely, and stops the moment a client pays." Buttons "Book a walkthrough" and "Try it live". The product IS the hero: a large phone showing a client's WhatsApp chat, running a client-side state machine, plus a ledger strip of 5-6 invoice chips below it, each with a PingMark. Autoplay loop: invoice arrives, reminder arrives, then one chip's ring closes into a check ("Paid") and the next reminder for it fades out with the caption "Reminder cancelled" while the other chips keep pulsing. The visitor can TAP inside the phone ("Pay now" or "Already Paid? Tap to Pause") and it responds; interaction pauses the autoplay. Faint ping rings emanate behind the phone. Under it, three small trust lines: "Money goes straight to your account", "Messages come from your own WhatsApp number", "You approve every claim". Only claim what is true of the design.
2. **The awkward moment (light).** One enormous sentence about how chasing a client feels, with whitespace. Optional subtle word-by-word reveal on scroll.
3. **How it works (light, scroll-pinned).** Four steps (Upload your pending invoices / We message your clients on WhatsApp / It follows up on schedule / It stops the moment they pay). The phone stays pinned on one side and changes state as each step scrolls into view, with a ping line connecting the steps. Mobile: stacked, no pinning.
4. **The promise (dark).** "We never remind someone who has already paid." Two lanes drawn as a small diagram (payment detected automatically / client taps "Already Paid"), both converging on "Reminders cancelled" with the ring-closes animation, plus a line that the owner confirms every "Already Paid" claim.
5. **Know who to chase (light, interactive).** A live mini version of the insights lists with 8 demo clients (labelled demo data) that the visitor can re-sort by Outstanding / Slowest payers / Most reliable (animated re-ordering). Show "Based on N invoices" on every label; neutral wording only.
6. **Money by age (light).** An animated aging bar (Not due / 1-7 days / 8-30 days / 30+ days) with hover details and count-up rupee totals, demo data labelled. Caption in plain words.
7. **Reports you get (dark).** Three sample report previews rendered from real components (not images), with "Open sample" and "Download PDF" per report. Links to /resources.
8. **Who it's for (light).** Wholesale distributors, chartered accountants, service businesses: three short, concrete lines each (what their Monday looks like), no icon-card grid; use a typographic list with a large numeral or ping marker.
9. **Compared (light).** A comparison table in the DevTrace style: columns "Following up by hand", "Generic reminder blasts", "PayPing"; rows such as: sends from your own WhatsApp number / stops the moment a client pays / lets the client say "already paid" / shows who to chase first / needs a switch of billing software. Compare categories, never name competitors, and mark every row `// CONFIRM` in site.ts so I can check accuracy before launch.
10. **Pricing.** "Start with a real collections run." One "Free pilot" card (founder-assisted setup, your first N invoices, private link for your clients' messages preview), and a line "Paid plans: talk to us" linking to /book-demo. Numbers are `// CONFIRM`.
11. **FAQ** (accordion, 8 honest answers): What do my clients see? Do I need a WhatsApp Business account? What if a client already paid? What about bank transfers outside the payment link? Is my data safe? Which payment gateways? Do you hold my money? How long does setup take? Say "coming soon" for anything not built (bank-statement matching, real WhatsApp sending beyond pilots).
12. **Closing CTA (dark).** Large serif line and the booking form inline (fields as in Phase 5).

**Footer (dark, generous):** large wordmark with a slowly pulsing ring; columns: Product (How it works, Live demo, Pricing), Resources (Sample reports, Message templates, Guides), Company (Book a walkthrough, Privacy, Terms), contact = CONTACT_EMAIL only; the line "PayPing is not affiliated with Meta, WhatsApp or Razorpay"; copyright. No phone, WhatsApp number, LinkedIn or founder name.

Also: proper <title>, meta description, Open Graph and Twitter images (generate a branded OG image from the hero motif), favicon from PingMark, sitemap.xml, robots.txt. Responsive down to 390px; no horizontal scroll; Lighthouse accessibility check (target 95+), keyboard navigation and visible focus rings.
VERIFY: typecheck; no dead links; reviewed screenshots at 1440 and 390 for every section; every interactive piece (hero phone, insights sorter, aging bar, FAQ, nav) works with keyboard.

## PHASE 4b – Resources page and sample reports (content, so the site has life)
Route /resources: one page, three sections, no heavy page tree.
1. **Sample reports.** Three reports shown as in-page previews and downloadable PDFs, built from the demo seed data and clearly stamped "SAMPLE – demo data": (a) Weekly Collections Summary (collected, outstanding, overdue, top 5 to chase, reminders sent, invoices paid after a reminder); (b) Receivables Aging (buckets table, top clients per bucket); (c) Client Payment Behaviour (per client: average days late, on-time rate, "Based on N invoices", neutral labels, no scores). Generate PDFs at build time with a script `scripts/build-sample-reports.ts` using pdfkit into `public/samples/`, with embedded fonts and the brand look (ink header, emerald accents, tabular rupee numbers). Same three reports can later be exported from the real dashboard.
2. **Message templates.** Copy-to-clipboard WhatsApp template wording for: invoice dispatch, 3-days-before reminder, due-date reminder, overdue reminder, payment-received thank-you. Each with {{variables}}, an English version and a Hindi version, and a note that wording must be submitted to Meta for approval and approval is not guaranteed. Mark the Hindi text `// CONFIRM (native review)`.
3. **Guides.** Two short original guides (~400 words each): "How to follow up on an overdue invoice without losing the client" and "A weekly collections routine for 50+ clients". No invented statistics, no legal claims.
VERIFY: PDFs open and look right; template copy buttons work; page passes the same responsive and accessibility checks.

## PHASE 4c – Scroll choreography (build ONLY after Phase 4 and 4b pass; the static site must already work)
Goal: a visitor scrolls and the page keeps explaining itself. One continuous "story spine" where the phone and the dashboard act like characters, not decorations. Premium means restrained and purposeful: every movement must explain something.

### The spine (sticky stages driven by native scroll progress)
**Stage A, "Sound familiar?" + how it works (about 450vh tall, one sticky viewport):**
1. Beat 1 (0-15%): hero phone glides from centre-right to dead centre and scales up slightly; hero headline fades up and away.
2. Beat 2 (15-45%) **"Messages you've typed and deleted."** In the phone's input box, drafts type out as you scroll and are then deleted character by character, one after another (e.g. "Hi Sharma ji, just a gentle reminder…" / "It's been 40 days. Is everything okay?" / "Please clear this today."). Around the phone, the quotes in `site.ts > frustrations[]` drift outward at slightly different speeds and fade (parallax only on these quote lines, never on body text). Heading: "Sound familiar?".
3. Beat 3 (45-75%): phone slides left; the four How-it-works steps appear on the right one at a time, each step changing the phone's state (invoice arrives, reminder arrives, client pays, ring closes into a check, next reminder fades out).
4. Beat 4 (75-100%) **ripple wipe**: the dark stage turns light through an expanding circular reveal (clip-path circle) that starts from the phone's PingMark. This ripple wipe is the signature transition; reuse it at the other dark/light section changes. The phone then exits.

**Stage B, "The live screen" (about 250vh):**
- The `<DashboardPreview />` (real dashboard components fed by static demo data, no backend) enters from the right with a slight perspective tilt (rotateY about -12deg, scale about 0.86) and flattens to 0deg as it reaches centre. Rows animate in. Then three annotated hotspots (pulsing PingMarks with short callouts) appear one by one: the "Needs your approval" tab, the "Needs attention today" list, the invoice timeline. After it settles it is interactive (tabs and sorting work). A "Try it live" link to /demo appears beneath.

**Elsewhere:** a thin vertical progress line at the left edge with a travelling dot; rupee numbers count up once; section headlines reveal line by line; the insights sorter and aging bar already specified in Phase 4 keep their own interactions.

### Quotes ("frustrations") - honesty rules
- Put 10 in `site.ts > frustrations[]` (comment above: `// Written by us as relatable thoughts, NOT testimonials. REPLACE with real, permissioned pilot quotes later.`).
- Display with NO names, avatars, ratings, company names or "customer" labelling. Style: italic serif, large, unattributed.
- Starter set: "It's been 40 days. Do I call again, or does that look desperate?" / "I sent the reminder. Then found out he'd paid that morning." / "I'm a chartered accountant. Why am I chasing people for my own fee?" / "If I message now it's rude. If I wait, it's ₹3 lakh." / "Seen at 9:14. No reply." / "She said she'd pay on Friday. Which Friday?" / "Another Monday, another list of people to be nice to about money." / "I don't want to lose the client. I also don't want to lose the money." / "Which ones did I already follow up with?" / "He pays everyone else first. I know he does."

### Rules that keep it premium (not gimmicky)
- NO scroll-jacking: use native scroll with `position: sticky` stages and scroll progress (`motion` useScroll/useTransform, or CSS `animation-timeline: view()` as progressive enhancement). Never intercept the wheel or touch events. Total pinned scroll under about 7 screens across both stages.
- Animate only transform, opacity and clip-path. At most 3 things moving at once in any beat. Use spring or cubic-bezier(0.22, 1, 0.36, 1); no bounce on body content. No autoplay sound, no video, no heavy libraries.
- Many visitors will be on mid-range Android phones on slow networks: on screens under 768px use a simpler version (sticky phone in the top half, text scrolling below, fade/slide only, no tilt, no clip-path wipe; use a fade). Lazy-load below-the-fold stages; keep the hero's LCP fast; keep CLS near zero.
- `prefers-reduced-motion`: render every beat as a static stacked section with the same content, no typing animation, no parallax.
- Keyboard and screen readers: all text content is present in the DOM in reading order; decorative animation is aria-hidden; no content is only visible through animation.
- Structure the code in `src/components/story/` (StoryStage, Phone, DraftTyper, RippleWipe, QuoteDrift, DashboardPreview) with timings and beat boundaries in one config object so I can tweak them.
VERIFY: Playwright scroll test captures screenshots at 0, 25, 50, 75 and 100% of each stage at 1440x900 and 390x844 into `design/review/`; no layout shift during scroll; reduced-motion mode renders all content; typecheck and `next build` pass; Lighthouse mobile performance 80+ and accessibility 95+ (report actual numbers in PROGRESS.md). Critique the screenshots using the Phase 3 checklist and fix, up to 2 rounds.

## PHASE 5 – Leads
/book-demo fields: name, business name, email, phone (optional), monthly invoices (<50, 50-200, 200-1000, 1000+), "I am a" (business owner, chartered accountant, investor or partner, other), optional message.
POST /api/leads: zod validation, honeypot, IP rate limit. POST the lead as JSON {secret, ...fields, createdAt} to LEADS_SHEET_WEBHOOK_URL with LEADS_SHEET_SECRET. On 2xx show "Thanks. We'll reply within one working day." If the webhook fails: log it, email the full lead via Resend (RESEND_API_KEY, LEAD_NOTIFY_EMAIL, RESEND_FROM), and still show success. Also always send the Resend notification when configured.
Write docs/leads-sheet-setup.md with the exact Apps Script doPost code (checks the secret, appends a row with columns Time, Name, Business, Email, Phone, Monthly invoices, I am a, Message, Source), the deploy steps ("Deploy as web app, execute as me, access: anyone"), and the env vars.
No Lead table or /admin/leads on the public path.
VERIFY: success path and webhook-failure path both tested with a mocked webhook; the form works with no DATABASE_URL.

## PHASE 6 – Vercel readiness
`next build` must pass with no DATABASE_URL and no Redis. /demo needs no backend (it is a browser simulation) and must work on Vercel; only /demo/live shows a clear "runs locally" notice when no Redis is configured. Add every env var to .env.example with comments. Write DEPLOY.md (Vercel steps, env vars, how to test the form end to end).

## FINAL VERIFY, then stop
typecheck passes; `next build` passes with no DB/Redis; e2e-demo.ts passes; no dead links; no console errors; layout checked at 390px. Print the DEMO RUNBOOK and a list of manual steps for me (Sheet + Apps Script, Resend key, Vercel env vars). Stop there.

---
# LATER (do NOT start; not part of this brief)
Real Meta Cloud API sender (templates, quick-reply payload `PAID_CLAIM:<invoiceId>`, delivery status webhooks, signature check); real Razorpay payment links; per-org encrypted credentials + settings page; real auth and multi-tenancy; Excel upload + column mapping; invoice PDF attach; opt-out handling; hosted worker/Redis/DB (Railway/Fly + Neon); Sentry; bull-board; Razorpay reconciliation cron; billing; payables view (bills owed, due dates, reminders to self) only if pilot customers ask for it; bank-statement upload with match-to-invoice suggestions (always sent to the approval tab, never auto-paid); AI assistant for questions and a daily summary (read-only, answers come from fixed database queries, never from model arithmetic, scoped per organization).