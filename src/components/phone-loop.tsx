"use client";

import { useEffect, useState } from "react";
import { siteContent } from "@/content/site";
import { PayPingIcon } from "@/components/icons";
import { PingMark } from "@/components/ping-mark";

const phone = siteContent.hero.phone;

export function PhoneLoop() {
  const [stage, setStage] = useState(0);
  const [manual, setManual] = useState(false);
  const [claimed, setClaimed] = useState(false);

  useEffect(() => {
    if (manual || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = window.setInterval(() => setStage((current) => (current + 1) % phone.scenes.length), 3000);
    return () => window.clearInterval(timer);
  }, [manual]);

  function chooseStage(nextStage: number) {
    setManual(true);
    setClaimed(false);
    setStage(nextStage);
  }

  function markPaid() {
    setManual(true);
    setClaimed(false);
    setStage(3);
  }

  function claimPaid() {
    setManual(true);
    setClaimed(true);
  }

  const paid = !claimed && stage >= 3;
  const cancelled = !claimed && stage === 4;
  const status = claimed ? "Reminders paused for review" : cancelled ? "Reminders cancelled" : paid ? "Paid" : "Invoice open";
  const activeCaption = claimed
    ? "The client says they have paid. You check before reminders resume."
    : phone.scenes[stage].caption;

  return (
    <div className="hero-product">
      <div className="hero-ping-rings" aria-hidden="true"><PingMark state="waiting" size={220} /></div>
      <div className="hero-phone-frame">
        <div className="hero-phone">
          <div className="hero-phone-top"><span className="phone-notch" /><span>10:08</span><span className="phone-signal"><PingMark state="waiting" size={11} /></span></div>
          <div className="hero-chat-head">
            <span className="hero-avatar"><PingMark state="waiting" size={24} /></span>
            <span><strong>PayPing</strong><small>{phone.business}</small></span>
            <span className="hero-chat-menu">···</span>
          </div>
          <div className="hero-chat-body" aria-live="polite">
            <div className="chat-date">TODAY</div>
            <div className="demo-bubble invoice-bubble">
              <small>INVOICE · {phone.invoiceNumber}</small>
              <strong>{new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(phone.amountRupees)}</strong>
              <span>Due {phone.dueDate}</span>
              <button type="button" onClick={markPaid}>{phone.payNow} <PayPingIcon name="Arrow" size={14} /></button>
              <button className="phone-quick-reply" type="button" onClick={claimPaid} aria-pressed={claimed}>
                {claimed ? "Button used · reminders paused" : phone.quickReply}
              </button>
            </div>
            {stage >= 1 && !claimed && (
              <div className={`demo-bubble reminder-bubble${cancelled ? " reminder-cancelled" : " bubble-visible"}`}>
                <span>{phone.reminderMessage}</span><small>10:04 ✓✓</small>
              </div>
            )}
            {stage >= 2 && (
              <div className="demo-bubble client-bubble client-visible">
                {claimed ? "I’ve already paid." : "Pay invoice"}<PayPingIcon name="Arrow" size={14} /><small>10:06</small>
              </div>
            )}
            {paid && (
              <div className="demo-bubble thank-you-bubble bubble-visible">
                <span>{phone.paidMessage}</span><small>10:07 ✓✓</small>
              </div>
            )}
            <div className={`payment-state${paid ? " payment-visible" : ""}`}>
              <span className="payment-check"><PingMark state={claimed ? "paused" : paid ? "paid" : "waiting"} size={21} /></span>
              <span><strong>{status}</strong><small>{phone.invoiceNumber} · ₹48,500</small></span>
            </div>
            <div className={`cancelled-reminder${cancelled ? " cancelled-visible" : ""}${claimed ? " cancelled-visible" : ""}`}>
              <span>{claimed ? "Awaiting owner review" : phone.nextReminder}</span>
              <strong>{claimed ? "Reminders paused" : phone.cancelledMessage}</strong>
            </div>
          </div>
          <div className="hero-phone-caption"><PingMark state={claimed ? "paused" : paid ? "paid" : "waiting"} size={14} />{claimed ? "Client asked to pause" : phone.scenes[stage].label}</div>
        </div>
      </div>
      <div className="product-caption"><span className="caption-line" />{activeCaption}</div>
      <div className="phone-progress" role="tablist" aria-label="Product walkthrough">
        {phone.scenes.map((item, index) => (
          <button key={item.label} type="button" role="tab" aria-label={item.label} aria-selected={stage === index && !claimed} className={stage === index && !claimed ? "active" : ""} onClick={() => chooseStage(index)} />
        ))}
      </div>
      <ol className="hero-ledger" aria-label="Example invoice ledger">
        {phone.ledger.map((invoice, index) => {
          const markState = index === 0 && paid ? "paid" : index === 0 && claimed ? "paused" : "waiting";
          return (
            <li key={invoice.invoiceNumber} className={index === 0 && cancelled ? "hero-ledger__paid" : ""}>
              <PingMark state={markState} size={17} />
              <span><strong>{invoice.invoiceNumber}</strong><small>{invoice.amount}</small></span>
              {index === 0 && cancelled && <small className="hero-ledger__note">Paid · next reminder cancelled</small>}
            </li>
          );
        })}
      </ol>
      <ul className="hero-trust" aria-label="Product safeguards">
        {siteContent.hero.trust.map((line) => <li key={line}><PingMark state="paid" size={15} />{line}</li>)}
      </ul>
    </div>
  );
}
