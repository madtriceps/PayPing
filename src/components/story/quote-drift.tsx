import type { CSSProperties } from "react";
import { siteContent } from "@/content/site";
import { storyConfig } from "@/components/story/config";

export function QuoteDrift({ progress }: { progress: number }) {
  const phase = Math.min(1, Math.max(0, (progress - storyConfig.stageA.draftsStart) / (storyConfig.stageA.draftsEnd - storyConfig.stageA.draftsStart)));
  const { quoteDuration, quoteFadeShare, quoteStagger } = storyConfig.stageA;

  return (
    <div className="story-quote-field" role="group" aria-label="Common thoughts about following up">
      {siteContent.frustrations.map((quote, index) => {
        const localProgress = (phase - index * quoteStagger) / quoteDuration;
        const active = localProgress >= 0 && localProgress <= 1;
        const travel = Math.min(1, Math.max(0, localProgress));
        const fade = Math.min(1, travel / quoteFadeShare, (1 - travel) / quoteFadeShare);
        const direction = index % 2 === 0 ? -1 : 1;
        const style = {
          "--quote-index": index,
          opacity: active ? Math.max(0, fade) : 0,
          transform: active
            ? `translate3d(${direction * travel * (18 + index * 2)}px, ${travel * (index % 3 - 1) * 18}px, 0)`
            : "translate3d(0, 0, 0)",
        } as CSSProperties;
        return <p className="story-quote" key={quote} style={style}>{quote}</p>;
      })}
    </div>
  );
}
