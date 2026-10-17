import { PingMark } from "@/components/ping-mark";
import { siteContent } from "@/content/site";

const story = siteContent.story;

const messages = [
  story.invoiceArrived,
  story.reminderArrived,
  "Client taps pay",
  story.paymentArrived,
];

export function Phone({ stepIndex }: { stepIndex: number }) {
  const paid = stepIndex >= 3;
  return (
    <div className="story-phone" role="group" aria-label={`Simulated invoice conversation with ${story.phoneClient}`}>
      <div className="story-phone__top">
        <PingMark state={paid ? "paid" : "waiting"} size={22} />
        <span><strong>{story.phoneClient}</strong><small>WhatsApp · demo conversation</small></span>
      </div>
      <div className="story-phone__chat">
        <span className="story-phone__date">TODAY</span>
        <div className="story-phone__bubble">
          <small>INVOICE · {story.phoneInvoice}</small>
          <p>{stepIndex === 0 ? "Here is your invoice, with a clear way to pay." : messages[stepIndex]}</p>
          <strong className="tabular-nums">₹48,500</strong>
          <span>Due {story.phoneDue}</span>
          <span className="story-phone__link">View invoice and pay <span aria-hidden="true">↗</span></span>
        </div>
        {stepIndex >= 1 && <div className="story-phone__bubble story-phone__bubble--reminder">{story.reminderArrived}</div>}
        {stepIndex >= 2 && <div className="story-phone__bubble story-phone__bubble--client">{stepIndex === 2 ? "Client taps the payment link" : "Payment received"}</div>}
        <div className={`story-phone__next${paid ? " story-phone__next--cancelled" : ""}`}>
          <PingMark state={paid ? "paid" : "waiting"} size={16} />
          {paid ? story.reminderCancelled : "Next reminder · scheduled"}
        </div>
      </div>
      <div className="story-phone__footer">
        <span>{messages[stepIndex]}</span>
        <PingMark state={paid ? "paid" : "waiting"} size={18} />
      </div>
    </div>
  );
}
