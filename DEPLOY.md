# Vercel deployment

The landing site, legal pages, booking form, and lead API can run on Vercel without Postgres or Redis. The invoice dashboard is a local demo; when database or Redis configuration is missing, `/demo` explains that it runs locally.

## Deploy

1. Push the project to a Git repository and import it into Vercel.
2. Use the detected Next.js build settings (`npm run build`).
3. Add the public-site and lead-delivery environment variables below in Vercel project settings for the required deployment environments.
4. Deploy, then test `/`, `/book-demo`, `/privacy`, `/terms`, and `/api/leads`.

Do not add database or Redis URLs for the marketing site. Do not enable live provider behavior as part of this demo deployment.

## Environment variables

| Variable | Required | Purpose |
|---|---:|---|
| `CONTACT_EMAIL` | Yes | Role email shown in the footer |
| `LEADS_SHEET_WEBHOOK_URL` | Yes for sheet storage | Deployed Apps Script `/exec` URL |
| `LEADS_SHEET_SECRET` | Yes for sheet storage | Shared secret checked by Apps Script |
| `RESEND_API_KEY` | Optional | Resend API key |
| `LEAD_NOTIFY_EMAIL` | Optional | Team inbox for notifications |
| `RESEND_FROM` | Optional | Verified Resend sender |

Configure all three Resend values together to enable email notifications. When both delivery methods are configured, PayPing sends each submission to both. See [docs/leads-sheet-setup.md](./docs/leads-sheet-setup.md) for the exact Apps Script code and deployment settings.

No `DATABASE_URL` or `REDIS_URL` is needed for the public pages or lead form. The complete local invoice demo additionally uses `DATABASE_URL`, `DIRECT_URL`, `REDIS_URL`, `DEMO_MODE`, `DEMO_TIME_COMPRESSION`, `DEMO_WEBHOOK_SECRET`, `META_WEBHOOK_VERIFY_TOKEN`, `REMINDER_SEND_HOUR_LOCAL`, `WORKER_CONCURRENCY`, and `WA_RATE_LIMIT_PER_SECOND`.

## End-to-end form test

Run `npm run test:leads` locally to mock a successful Apps Script request and an Apps Script rejection with Resend fallback. The test explicitly removes database and Redis variables and does not send any real lead data.

After deployment, configure the Apps Script webhook and (optionally) Resend. Submit a clearly identifiable test enquiry through `/book-demo`, confirm the row appears in the configured sheet and the notification arrives, then remove the test row and email. Never use a real person's details for the smoke test.
