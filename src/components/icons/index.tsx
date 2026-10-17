import type { ReactNode } from "react";

export type PayPingIconName =
  | "Upload"
  | "Send"
  | "Reminder"
  | "Paid"
  | "Pause"
  | "Client"
  | "Overdue"
  | "Report"
  | "Link"
  | "Shield"
  | "Clock"
  | "Chart"
  | "Arrow"
  | "Close";

const paths: Record<PayPingIconName, ReactNode> = {
  Upload: <><path d="M12 16V4" /><path d="m7 9 5-5 5 5" /><path d="M4 20h16" /></>,
  Send: <><path d="m21 3-7.2 18-3.5-7.3L3 10.2 21 3Z" /><path d="m10.3 13.7 4.2-4.2" /></>,
  Reminder: <><path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" /><path d="M10 21h4" /></>,
  Paid: <><path d="M5 12.5 9.2 16 19 6.5" /><path d="M12 3v2" /></>,
  Pause: <><path d="M9 5v14M15 5v14" /><path d="M6 3h12v18H6z" /></>,
  Client: <><circle cx="12" cy="8" r="3.4" /><path d="M5 20a7 7 0 0 1 14 0" /></>,
  Overdue: <><circle cx="12" cy="12" r="8.5" /><path d="M12 7v5l3 2" /><path d="M18.5 4.5 20 3" /></>,
  Report: <><path d="M6 3h8l4 4v14H6z" /><path d="M14 3v5h5M9 16v-3m3 3v-5m3 5v-7" /></>,
  Link: <><path d="M10 13.5a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1.5 1.5" /><path d="M14 10.5a4 4 0 0 0-5.7 0l-3 3A4 4 0 0 0 11 19.2l1.5-1.5" /></>,
  Shield: <><path d="M12 3 20 6v5.5c0 4.4-3.1 7.7-8 9.5-4.9-1.8-8-5.1-8-9.5V6l8-3Z" /><path d="m8.5 12 2.2 2.2 4.8-4.8" /></>,
  Clock: <><circle cx="12" cy="12" r="8.5" /><path d="M12 7v5l3.2 2" /></>,
  Chart: <><path d="M4 19V5M4 19h16" /><path d="m7 15 4-4 3 2 5-6" /></>,
  Arrow: <><path d="M7 17 17 7" /><path d="M8 7h9v9" /></>,
  Close: <><path d="m18 6-12 12" /><path d="m6 6 12 12" /></>,
};

export function PayPingIcon({ name, size = 18 }: { name: PayPingIconName; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {paths[name]}
      <circle cx="20" cy="4" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="20" cy="4" r="2.1" stroke="currentColor" strokeWidth="0.8" opacity="0.55" />
    </svg>
  );
}

type UtilityIconName = "arrow" | "upload" | "phone" | "close" | "check" | "clock" | "file" | "spark";

const utilityNames: Record<UtilityIconName, PayPingIconName> = {
  arrow: "Arrow",
  upload: "Upload",
  phone: "Client",
  close: "Close",
  check: "Paid",
  clock: "Clock",
  file: "Report",
  spark: "Reminder",
};

export function UtilityIcon({ name, size = 18 }: { name: UtilityIconName; size?: number }) {
  return <PayPingIcon name={utilityNames[name]} size={size} />;
}
