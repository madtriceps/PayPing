export const DEMO_ORG_ID = "payping-demo-org";

export function isDemoModeEnabled(): boolean {
  return process.env.DEMO_MODE === "true";
}
