type PingMarkProps = {
  state: "waiting" | "paid" | "paused";
  size?: number;
};

export function PingMark({ state, size = 22 }: PingMarkProps) {
  return (
    <svg
      className="ping-mark"
      data-state={state}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle className="ping-mark__ring ping-mark__ring--outer" cx="12" cy="12" r="9" />
      <circle className="ping-mark__ring ping-mark__ring--inner" cx="12" cy="12" r="6" />
      <circle className="ping-mark__core" cx="12" cy="12" r="2.4" />
      <path className="ping-mark__check" d="m8.5 12.4 2.2 2.1 4.9-5" />
    </svg>
  );
}
