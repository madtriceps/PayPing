import type { CSSProperties } from "react";
import { storyConfig } from "@/components/story/config";

export function RippleWipe({ progress }: { progress: number }) {
  const amount = Math.min(1, Math.max(0, (progress - storyConfig.stageA.wipeStart) / (storyConfig.stageA.wipeEnd - storyConfig.stageA.wipeStart)));
  const style = {
    clipPath: `circle(${amount * 150}vmax at calc(25vw - min(170px, 14vw) + 22px) calc(53vh - 238px))`,
    opacity: amount > 0 ? 1 : 0,
  } as CSSProperties;

  return <div className="story-ripple-wipe" aria-hidden="true" style={style} />;
}
