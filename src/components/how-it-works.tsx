"use client";

import { useEffect, useRef, useState } from "react";
import { siteContent } from "@/content/site";
import { PayPingIcon, type PayPingIconName } from "@/components/icons";
import { PingMark } from "@/components/ping-mark";

const steps = siteContent.howItWorks.steps;
const icons: PayPingIconName[] = ["Upload", "Send", "Reminder", "Paid"];

export function HowItWorks() {
  const [activeStep, setActiveStep] = useState(0);
  const stepsRef = useRef<HTMLOListElement>(null);

  useEffect(() => {
    const list = stepsRef.current;
    if (!list) return;
    const observer = new IntersectionObserver((entries) => {
      const visible = entries
        .filter((entry) => entry.isIntersecting)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (visible) setActiveStep(Number((visible.target as HTMLElement).dataset.stepIndex));
    }, { threshold: [0.25, 0.5, 0.75] });
    list.querySelectorAll("[data-step-index]").forEach((step) => observer.observe(step));
    return () => observer.disconnect();
  }, []);

  const finalStep = activeStep === steps.length - 1;

  return (
    <section className="how-section" id="how-it-works">
      <div className="how-visual" aria-live="polite">
        <p className="site-eyebrow">{siteContent.howItWorks.phoneEyebrow}</p>
        <div className="how-phone">
          <div className="how-phone__top"><PingMark state="waiting" size={23} /><span><strong>PayPing</strong><small>Client invoice</small></span></div>
          <div className="how-phone__message">
            <span>{siteContent.howItWorks.steps[activeStep].phoneState}</span>
            <p>{activeStep === steps.length - 1 ? siteContent.promise.outcome : siteContent.howItWorks.phoneMessage}</p>
            <PingMark state={finalStep ? "paid" : "waiting"} size={29} />
          </div>
          <div className="how-phone__footer">{siteContent.howItWorks.steps[activeStep].phoneState}</div>
        </div>
        <div className="how-visual__progress">
          <span style={{ width: `${((activeStep + 1) / steps.length) * 100}%` }} />
        </div>
      </div>
      <div className="how-steps-content">
        <div className="section-intro">
          <p className="site-eyebrow">{siteContent.howItWorks.eyebrow}</p>
          <h2>{siteContent.howItWorks.headline}</h2>
        </div>
        <ol className="steps-list" ref={stepsRef}>
          {steps.map((step, index) => (
            <li key={step.title} data-step-index={index} className={activeStep === index ? "step-active" : ""}>
              <span className="step-number"><PayPingIcon name={icons[index]} size={22} /></span>
              <div><h3>{step.title}</h3><p>{step.body}</p></div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
