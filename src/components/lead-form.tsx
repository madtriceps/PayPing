"use client";

import { useState, type FormEvent } from "react";
import { siteContent } from "@/content/site";

export function EarlyAccessForm() {
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("sending");
    setError("");
    const form = event.currentTarget;
    const values = Object.fromEntries(new FormData(form).entries());
    try {
      const response = await fetch("/api/leads", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...values, source: "book-demo" }),
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "We couldn’t send that just now. Please try again.");
      setStatus("sent");
      form.reset();
    } catch (caught) {
      setStatus("error");
      setError(caught instanceof Error ? caught.message : "We couldn’t send that just now. Please try again.");
    }
  }

  if (status === "sent") {
    return <div className="form-confirmation" role="status"><span className="confirmation-mark">✓</span><div><strong>{siteContent.form.confirmation}</strong></div></div>;
  }

  return (
    <form className="lead-form" onSubmit={submit}>
      <label>{siteContent.form.name}<input name="name" autoComplete="name" required maxLength={100} /></label>
      <label>{siteContent.form.businessName}<input name="businessName" autoComplete="organization" required maxLength={120} /></label>
      <div className="form-row">
        <label>{siteContent.form.email}<input name="email" autoComplete="email" required type="email" maxLength={254} /></label>
        <label>{siteContent.form.phone}<input name="phone" autoComplete="tel" type="tel" maxLength={30} /></label>
      </div>
      <label>{siteContent.form.monthlyInvoices}
        <select name="monthlyInvoices" required defaultValue="">
          {siteContent.form.monthlyInvoiceOptions.map((option) => <option key={option.value} value={option.value} disabled={option.value === ""}>{option.label}</option>)}
        </select>
      </label>
      <label>{siteContent.form.persona}
        <select name="persona" required defaultValue="">
          {siteContent.form.personaOptions.map((option) => <option key={option.value} value={option.value} disabled={option.value === ""}>{option.label}</option>)}
        </select>
      </label>
      <label>{siteContent.form.message}<textarea name="message" rows={4} maxLength={2000} /></label>
      <label className="honeypot-field" aria-hidden="true">Leave this empty<input name="website" tabIndex={-1} autoComplete="off" /></label>
      {status === "error" && <p className="form-error" role="alert">{error}</p>}
      <button className="button-primary form-submit" disabled={status === "sending"}>{status === "sending" ? siteContent.form.sending : siteContent.form.submit}<span aria-hidden="true">↗</span></button>
      <p className="form-privacy">{siteContent.form.privacy}</p>
    </form>
  );
}
