export const COMPRESSED_REMINDER_SEQUENCE = [
  { kind: "INITIAL_DISPATCH", offsetMs: 0 },
  { kind: "BEFORE_DUE_3D", offsetMs: 20_000 },
  { kind: "ON_DUE_DATE", offsetMs: 40_000 },
  { kind: "AFTER_DUE_2D", offsetMs: 60_000 },
] as const;

export const COMPRESSED_REMINDER_INTERVAL_MS = COMPRESSED_REMINDER_SEQUENCE[1].offsetMs;
export const COMPRESSED_REMINDER_DURATION_MS = COMPRESSED_REMINDER_SEQUENCE[3].offsetMs;

export function reminderEventsDue(elapsedMs: number) {
  return COMPRESSED_REMINDER_SEQUENCE.filter((event) => event.offsetMs <= elapsedMs);
}
