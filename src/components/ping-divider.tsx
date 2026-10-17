"use client";

import { useEffect, useRef, useState } from "react";
import { PingMark } from "@/components/ping-mark";

export function PingDivider() {
  const dividerRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const divider = dividerRef.current;
    if (!divider || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setVisible(true);
        observer.disconnect();
      }
    }, { threshold: 0.6 });
    observer.observe(divider);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={dividerRef} className={`ping-divider${visible ? " ping-divider--visible" : ""}`} aria-hidden="true">
      <span className="ping-divider__line" />
      <span className="ping-divider__traveler"><PingMark state="waiting" size={18} /></span>
    </div>
  );
}
