# Lead delivery setup

The booking form sends submissions to a Google Sheet Apps Script web app. Resend can also email each lead to the team. No database or Redis is used by the lead endpoint.

## Google Sheet and Apps Script

1. Create a Google Sheet for PayPing leads and open **Extensions → Apps Script**.
2. Add the following code to `Code.gs`:

```javascript
function doPost(e) {
  try {
    const lead = JSON.parse(e.postData.contents);
    const expectedSecret = PropertiesService.getScriptProperties()
      .getProperty("LEADS_SHEET_SECRET");
    if (!expectedSecret || lead.secret !== expectedSecret) {
      return json({ ok: false, error: "unauthorized" });
    }

    const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    if (sheet.getLastRow() === 0) {
      sheet.appendRow([
        "Time",
        "Name",
        "Business",
        "Email",
        "Phone",
        "Monthly invoices",
        "I am a",
        "Message",
        "Source"
      ]);
    }
    sheet.appendRow([
      lead.createdAt || new Date().toISOString(),
      cell(lead.name),
      cell(lead.businessName),
      cell(lead.email),
      cell(lead.phone || ""),
      cell(lead.monthlyInvoices),
      cell(lead.persona),
      cell(lead.message || ""),
      cell(lead.source)
    ]);
    return json({ ok: true });
  } catch (error) {
    console.error(error);
    return json({ ok: false, error: "invalid request" });
  }
}

function json(value) {
  return ContentService
    .createTextOutput(JSON.stringify(value))
    .setMimeType(ContentService.MimeType.JSON);
}

function cell(value) {
  const text = String(value);
  return /^[\s]*[=+\-@]/.test(text) ? "'" + text : text;
}
```

3. In **Project Settings → Script Properties**, add `LEADS_SHEET_SECRET` with a long random value. Use the same value in the app environment; do not commit it.
4. Choose **Deploy → New deployment → Web app**. Set **Execute as** to **Me** and **Who has access** to **Anyone**, then deploy and copy the URL ending in `/exec`.
5. If Google prompts for authorization, authorize the script using the account that owns the sheet.

The endpoint returns `{"ok":true}` after appending. The PayPing API checks this response as well as the HTTP status because Apps Script may return HTTP 200 for rejected requests.

## Resend

Create a Resend API key and verify the sender domain/address used by `RESEND_FROM`. The notification includes the submitted name, business, email, optional phone, invoice volume, audience, message, source, and submission time.

## Environment variables

Set these on the deployment and in local `.env` when testing:

| Variable | Value |
|---|---|
| `LEADS_SHEET_WEBHOOK_URL` | Deployed Apps Script `/exec` URL |
| `LEADS_SHEET_SECRET` | Same secret as the Apps Script project property |
| `RESEND_API_KEY` | Resend API key |
| `LEAD_NOTIFY_EMAIL` | Team inbox that receives enquiries |
| `RESEND_FROM` | Verified sender, for example `PayPing <leads@example.com>` |
| `CONTACT_EMAIL` | Role email displayed in the site footer |

The sheet webhook is the primary store. When both the sheet and Resend are configured, each lead is sent to both. If the sheet webhook rejects or is unreachable, PayPing logs the delivery error and attempts the Resend notification; it shows the confirmation state when that email succeeds. If no destination accepts the lead, the form reports that it could not save the request.

## Local test

Run `npm run test:leads`. It replaces outbound `fetch` calls with an in-process mock, tests both a successful sheet write and a rejected-sheet fallback email, and removes database/Redis environment variables for the test process.
