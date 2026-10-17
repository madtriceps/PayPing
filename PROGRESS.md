# PayPing implementation progress

Following `AGENT_BRIEF.md` in order. Later-phase work must not begin until the preceding phase verifies. Decisions are recorded here rather than deferred to the user.

## Decisions

- Keep the existing Next.js/Prisma/BullMQ demo. Provider integrations remain mocked when `DEMO_MODE=true`; no provider credentials UI or live Meta/Razorpay calls.
- `/book-demo` is the only enquiry path. No contact page or personal contact details.
- Lead submissions use the configured Apps Script webhook and Resend, not the public database path. The unused Prisma Lead model/table is retained temporarily to avoid deleting any existing local data; no public route or page accesses it, and the admin inbox/routes are removed.
- Resend is integrated with the existing `fetch` API rather than adding a dependency.
- Redis/BullMQ connections are initialized only when the demo queue is used. This keeps importing demo webhook modules side-effect-free during Vercel builds without Redis.
- Do not add authentication, UI libraries, or features marked LATER in the brief.

## Step status

| Phase / step | Status | Verification |
|---|---|---|
| 1.0 – Project setup and compile | Done | Docker services, Prisma validation/database sync, and TypeScript pass. A Prisma engine rename was locked by the running demo; rerunning `db push --skip-generate` passed. |
| 1.1 – Demo adapters and compressed queue | Done | `npm run verify:schedule`: 4 jobs at 0/20/40/60 seconds. |
| 1.2 – Seed, CSV upload, dashboard | Done | Existing implementation seeds the fixed organization and displays the uploaded invoices; E2E verifies the upload/dispatch path. |
| 1.3 – Payment/claim reconciliation | Done | `npm run e2e:demo` passes webhook payment, idempotency, claim pause/resume, and the compressed reminders. |
| 1.4 – Demo runbook | Done | `npm run demo` runs Docker setup, schema sync, seed, production build, app, and worker. |
| 2 – Phone simulator | Done | Implemented with live message polling and real demo claim/payment handlers; covered by the latest successful E2E. |
| 2.5 – Collections insights and invoice tabs | Done | Eight demo history clients, pure insight metrics/tests, client directory/details, aging metrics, dashboard lists, search/sort/status tabs, URL tab state and paid-claim confirmation actions added. |
| 2.7 – Guided demo page | Implemented; full spec verification blocked | `/demo` is a browser-only virtual-clock simulation; `/demo/live` keeps the backend dashboard. Tested payment, claim pause, local CSV and mobile navigation. `DEMO_PAGE_SPEC.md` is missing, so its Commands 1–10 and Definition of Done cannot be verified. |
| 3 – Brand and design system | Done | PingMark, hand-built icons, Instrument Serif/Geist, dark/light rhythm, hero motif, reduced-motion states, and responsive review screenshots are implemented. Shadow definitions use centralized elevation tokens. |
| 4 – Public site | Implemented; Lighthouse score pending | Landing sections, navigation/footer, routes, metadata, sample insights, comparison, pricing, FAQ and forms are present. Primary routes return HTTP 200; `/contact` has no remaining links. |
| 4b – Resources and sample reports | Done | Three report previews/PDFs, bilingual templates and two ~400-word guides are verified. Required sample/PDF links and copy controls work. |
| 4c – Scroll choreography | Implemented; Lighthouse score pending | Stage A/B, responsive static mobile flow, reduced-motion stack, keyboard-operable dashboard preview and story timing config are implemented. Twenty 1440×900 / 390×844 milestone screenshots are saved and reviewed in `design/review/`. |
| 5 – Lead delivery | Done | Lead API uses Apps Script and Resend without Prisma; setup guide and mocked success/fallback tests pass. |
| 6 – Vercel readiness | Done | Production build passes, including the earlier build-without-`.env` check; primary public routes respond successfully. |

## Verification log

- Phase 1 Step 0: `docker compose up -d` passed; `npx prisma validate` passed; `npx prisma db push --skip-generate` passed; `npm run typecheck` passed.
- Phase 1 Step 1: `npm run verify:schedule` passed (four compressed jobs at 0/20/40/60 seconds).
- Phase 1 Steps 2–4: `npm run e2e:demo` passed; production `npm run build` passed and the demo server returned HTTP 200 on the marketing and demo routes.
- Existing `npm run e2e:demo` output: 5 invoice dispatches, payment webhook/idempotency, claim pause/resume, and all three reminders for an untouched invoice passed.
- `npm run test:leads` passed: mocked Apps Script success and rejected-sheet/Resend fallback both work without database or Redis variables.
- Checked `/`, `/book-demo`, `/privacy`, `/terms`, and `/demo` at a 390px browser viewport: HTTP 200, no horizontal overflow, no dead `/contact` link, and no console errors.
- Removed admin routes and the public lead route's Prisma dependency. The existing Lead schema model is retained only to avoid destructive local data loss.
- `npm run build` passed with `.env` temporarily moved aside, confirming no `DATABASE_URL` or `REDIS_URL` is needed. Verified the static `/demo` output displays “The live demo runs locally.”
- `npm run demo` passed after the lazy queue change; `npm run e2e:demo` passed against that build.
- Browser form submission with a mocked 201 response displayed the exact working-day confirmation; no live Apps Script or Resend call was made.
- Phase 2.5: `npm run verify:insights`, `npm run test:insights`, and typecheck pass. Eight repeatable demo clients have three historical paid invoices each, with early/on-time/late mixes and open invoices. The dashboard has four ranked lists and URL-backed invoice tabs; `/demo/clients` has filters, sorting, and client payment timelines.
- The local production demo is running at `http://127.0.0.1:3000`.
- `npm audit --omit=dev` previously reported Prisma tooling advisories; Prisma 7 migration is outside this brief. The Prisma seed configuration deprecation warning is non-blocking.
- Re-verified Phase 2.5 with a seeded production restart, `npm run typecheck`, `npm run verify:insights`, `npm run test:insights`, and `npm run e2e:demo`. Browser checks confirmed 13 client rows (8 with payment histories and 5 active demo clients), the “Not enough history” filter returns 5 rows, client details open, and the mobile directory has no horizontal overflow. The Active invoice tab filters to 7 invoices and updates the URL to `?tab=active`.
- Browser review found the dashboard count-up could remain at zero while a tab was backgrounded because animation frames are throttled. Amount and count animations now settle to their real value on a hidden-tab transition, while still respecting reduced-motion preferences.
- Phase 3: added the reusable waiting/paid/paused PingMark, 12 required hand-built icons plus small utility glyphs, favicon, Instrument Serif and Geist through `next/font`, hero/promise/closing dark surfaces, a full-bleed dark hero with high-contrast white headline, faint phone rings, and scroll-activated ping dividers. Replaced the demo's logo/status dots with PingMark and kept its reduced-motion fallback.
- Phase 3 visual review: screenshots saved under `design/review/` for the hero, awkward moment, how-it-works, promise, audience, early-access, FAQ and dashboard at 1440×900 and 390×844. Review caught low hero contrast and a constrained banner edge; headline/support copy are now legible and the hero background runs evenly edge to edge with no horizontal overflow. Existing lower sections appear as the viewport scrolls; desktop and mobile review screenshots were captured at each section anchor.
- Phase 3 verification: `npm run typecheck`, `npm run build`, `npm run test:insights`, `npm run verify:insights`, and `npm run e2e:demo` passed. The build downloaded/embedded the requested Google fonts through Next's font pipeline; no project runtime dependency was added for screenshots.
- Phase 2.7 re-check: confirmed the referenced `DEMO_PAGE_SPEC.md` does not exist in the workspace. In the browser, uploaded the sample CSV to `/demo` and saw five invoices loaded locally; observed zero POSTs to `/api/invoices/upload`. The “Already Paid?” action displayed the pause status. Payment changed the selected invoice to Paid, showed the thank-you bubble, cancelled three upcoming reminders, and exposed the callback form. The 390px view had no horizontal overflow; the mobile menu opened and Escape closed it. Saved `design/review/guided-demo-390.png` and refreshed `design/review/guided-demo-1440.png`.
- Updated the README routes after `/demo` moved to the browser-only guided simulation; the seeded backend dashboard is `/demo/live`.
- Phase 4b audit: resources, three report preview components, generated sample PDFs, five English/Hindi message templates, and two expanded guides are present. Fixed missing report download/open links on `/resources`; PDFs, copy behavior and responsive layout were rechecked.
- Phase 3 depth audit: centralized rest/raised/float/device/button/dark-edge shadow tokens in `globals.css`; replaced legacy component-specific shadows and changed focus rings to outlines.
- Phase-order check: Phase 4 and 4b verification is complete enough to proceed with Phase 4c, then Phase 5 and Phase 6. The remaining Phase 2.7 specification and Lighthouse score gaps are recorded below.
- Final verification after completing Phase 4c: `npm run typecheck`, `npm run test:insights`, `npm run verify:schedule`, `npm run verify:insights`, `npm run test:leads`, `npm run build:samples`, `npm run build`, and `npm run e2e:demo` all pass. The lead test's logged Apps Script rejection is its expected fallback case; the Resend fallback assertion passes.
- The latest E2E run uploaded five invoices, verified all initial sends, payment-webhook idempotency and thank-you delivery, claim pause/resume, and all three compressed reminders for an untouched invoice.
- Production checks returned HTTP 200 for `/`, `/demo`, `/demo/live`, `/resources`, and `/book-demo`. Browser checks found no current console errors, no `/contact` references, and no horizontal overflow at 390px.
- Phase 4c browser review exercised both stages at progress 0/25/50/75/100. Desktop stage heights remained fixed at 4050px and 2250px; the desktop document width matched its client width. The dashboard preview passed arrow-key tab navigation, tab filtering, client sorting, and invoice timeline selection.
- Reduced-motion review at desktop and mobile widths showed the static story flow with all ten thought lines and all four steps, no sticky phone or typing line, and a visible dashboard preview. Mobile without reduced motion uses the non-pinned layout.
- Saved and dimension-checked 20 screenshots in `design/review/scroll-story-*.png`: five milestones for each stage at both 1440×900 and 390×844. Visual review caught and fixed heading/phone/dashboard overlap during Stage A's draft-to-steps transition; Stage B's attention hotspot and mobile dashboard layout were also checked.
- Lighthouse was not run: no Lighthouse runner is configured in the project. Record actual mobile performance/accessibility scores before claiming the brief's 80+/95+ targets.
- Remaining blockers: `DEMO_PAGE_SPEC.md` is absent, so Phase 2.7's Commands 1–10 and its full Definition of Done cannot be verified; Lighthouse scores remain outstanding. Do not print the final DEMO RUNBOOK until both gaps are resolved.
