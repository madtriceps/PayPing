import { siteContent } from "@/content/site";
import { storyConfig } from "@/components/story/config";

function textAtProgress(progress: number) {
  const draftProgress = Math.min(1, Math.max(0, (progress - storyConfig.stageA.draftsStart) / (storyConfig.stageA.draftsEnd - storyConfig.stageA.draftsStart)));
  if (draftProgress === 0) return "";

  const position = Math.min(siteContent.story.drafts.length - 0.0001, draftProgress * siteContent.story.drafts.length);
  const index = Math.floor(position);
  const withinDraft = position - index;
  const draft = siteContent.story.drafts[index];
  const typingShare = storyConfig.stageA.draftTypingShare;
  const typingProgress = withinDraft < typingShare
    ? withinDraft / typingShare
    : 1 - ((withinDraft - typingShare) / (1 - typingShare));
  return draft.slice(0, Math.round(draft.length * Math.max(0, typingProgress)));
}

export function DraftTyper({ progress }: { progress: number }) {
  return (
    <div className="story-draft">
      <p className="story-draft__label">Drafting a message</p>
      <p className="story-draft__line" aria-hidden="true">{textAtProgress(progress)}<span /></p>
      <ul className="story-draft__static">
        {siteContent.story.drafts.map((draft) => <li key={draft}>{draft}</li>)}
      </ul>
      <ul className="sr-only" aria-label="Message drafts">
        {siteContent.story.drafts.map((draft) => <li key={draft}>{draft}</li>)}
      </ul>
    </div>
  );
}
