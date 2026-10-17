"use client";

import { useRef, type CSSProperties } from "react";
import { PingMark } from "@/components/ping-mark";
import { siteContent } from "@/content/site";
import { storyConfig } from "@/components/story/config";
import { DraftTyper } from "@/components/story/draft-typer";
import { Phone } from "@/components/story/phone";
import { QuoteDrift } from "@/components/story/quote-drift";
import { RippleWipe } from "@/components/story/ripple-wipe";
import { useStoryProgress } from "@/components/story/use-story-progress";

const steps = siteContent.howItWorks.steps;
const story = siteContent.story;

function clamp(value: number) {
  return Math.min(1, Math.max(0, value));
}

export function StoryStage() {
  const sectionRef = useRef<HTMLElement>(null);
  const progress = useStoryProgress(sectionRef);
  const headlineProgress = clamp(progress / storyConfig.stageA.headlineEnd);
  const stepsProgress = clamp(
    (progress - storyConfig.stageA.stepsRevealStart) / (storyConfig.stageA.stepsEnd - storyConfig.stageA.stepsRevealStart),
  );
  const phoneMoveProgress = clamp(
    (progress - storyConfig.stageA.phoneMoveStart) / (storyConfig.stageA.stepsRevealStart - storyConfig.stageA.phoneMoveStart),
  );
  const activeStep = progress < storyConfig.stageA.stepsRevealStart
    ? 0
    : Math.min(steps.length - 1, Math.floor(stepsProgress * steps.length));
  const phoneX = progress < storyConfig.stageA.headlineEnd
    ? storyConfig.stageA.phoneRightTravelVw * (1 - headlineProgress)
    : progress < storyConfig.stageA.stepsStart
      ? storyConfig.stageA.phoneDraftTravelVw * clamp(
        (progress - storyConfig.stageA.headlineEnd) / (storyConfig.stageA.stepsStart - storyConfig.stageA.headlineEnd),
      )
      : progress < storyConfig.stageA.phoneMoveStart
        ? storyConfig.stageA.phoneDraftTravelVw
        : progress < storyConfig.stageA.stepsRevealStart
          ? storyConfig.stageA.phoneDraftTravelVw
            + (storyConfig.stageA.phoneLeftTravelVw - storyConfig.stageA.phoneDraftTravelVw) * phoneMoveProgress
          : progress < storyConfig.stageA.stepsEnd
            ? storyConfig.stageA.phoneLeftTravelVw
      : storyConfig.stageA.phoneExitVw;
  const phoneScale = storyConfig.stageA.phoneStartScale + (1 - storyConfig.stageA.phoneStartScale) * headlineProgress;
  const phoneStyle = {
    transform: `translate(-50%, -50%) translate3d(${phoneX}vw, 0, 0) scale(${phoneScale})`,
    opacity: progress > storyConfig.stageA.phoneFadeStart
      ? clamp((1 - progress) / (1 - storyConfig.stageA.phoneFadeStart))
      : 1,
  } as CSSProperties;
  const openingStyle = {
    opacity: 1 - headlineProgress,
    transform: `translateY(${-18 * headlineProgress}px)`,
  } as CSSProperties;
  const draftHeadingProgress = clamp(
    (progress - storyConfig.stageA.draftsStart) / (storyConfig.stageA.draftsEnd - storyConfig.stageA.draftsStart),
  );
  const draftHeadingStyle = {
    opacity: draftHeadingProgress * (1 - clamp(
      (progress - storyConfig.stageA.stepsStart) / (storyConfig.stageA.draftHeadingFadeEnd - storyConfig.stageA.stepsStart),
    )),
    transform: `translateY(${12 * (1 - draftHeadingProgress)}px)`,
  } as CSSProperties;
  const stepsStyle = {
    opacity: clamp((progress - storyConfig.stageA.stepsRevealStart) / storyConfig.stageA.stepsFadeIn),
  } as CSSProperties;

  return (
    <section
      ref={sectionRef}
      className="story-stage"
      aria-label={story.heading}
      style={{
        "--story-stage-height": `${storyConfig.stageA.heightVh}vh`,
        "--story-transition-ms": `${storyConfig.transitionMs}ms`,
      } as CSSProperties}
    >
      <div className="story-stage__sticky">
        <div className="story-stage__canvas">
          <RippleWipe progress={progress} />
          <div className="story-stage__opening" style={openingStyle}>
            <p className="site-eyebrow">{siteContent.hero.eyebrow}</p>
            <h2>{siteContent.hero.headline} <em>{siteContent.hero.emphasis}</em></h2>
          </div>
          <div className="story-stage__draft-heading" style={draftHeadingStyle}>
            <p className="site-eyebrow">{story.heading}</p>
            <h2>{story.draftsHeading}</h2>
          </div>
          <div className="story-stage__phone-anchor" style={phoneStyle}>
            <Phone stepIndex={activeStep} />
            <DraftTyper progress={progress} />
          </div>
          <QuoteDrift progress={progress} />
          <div className="story-stage__steps" style={stepsStyle}>
            <p className="site-eyebrow">{siteContent.howItWorks.eyebrow}</p>
            <h2>{story.stepsHeading}</h2>
            <ol>
              {steps.map((step, index) => (
                <li className={index === activeStep ? "story-step story-step--active" : "story-step"} key={step.title} aria-current={index === activeStep ? "step" : undefined}>
                  <PingMark state={index < activeStep ? "paid" : index === activeStep ? "waiting" : "paused"} size={24} />
                  <span><strong>{step.title}</strong><small>{step.body}</small></span>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </div>

      <div className="story-mobile-flow">
        <div className="story-mobile-phone"><Phone stepIndex={3} /></div>
        <div className="story-mobile-copy">
          <p className="site-eyebrow">{story.heading}</p>
          <h2>{story.draftsHeading}</h2>
          <DraftTyper progress={0.3} />
          <ul className="story-mobile-quotes">
            {siteContent.frustrations.map((quote) => <li key={quote}>{quote}</li>)}
          </ul>
          <p className="site-eyebrow">{siteContent.howItWorks.eyebrow}</p>
          <h2>{story.stepsHeading}</h2>
          <ol className="story-mobile-steps">
            {steps.map((step) => <li key={step.title}><PingMark state="waiting" size={21} /><span><strong>{step.title}</strong><small>{step.body}</small></span></li>)}
          </ol>
        </div>
      </div>
    </section>
  );
}
