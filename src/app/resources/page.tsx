import type { Metadata } from "next";
import { CopyTemplateButton } from "@/components/copy-template-button";
import { ReportPreviews } from "@/components/report-previews";
import { siteContent } from "@/content/site";

export const metadata: Metadata = {
  title: "Resources | PayPing",
  description: "Sample PayPing reports, invoice message templates and practical guides for considerate follow-up.",
};

export default function ResourcesPage() {
  return (
    <main className="resources-page">
      <header className="resources-intro">
        <p className="site-eyebrow">{siteContent.reportsPage.eyebrow}</p>
        <h1>{siteContent.reportsPage.headline}</h1>
        <p>{siteContent.resources.sampleDataNotice}</p>
      </header>

      <section className="resources-section" id="reports">
        <div className="resources-section-heading">
          <p className="site-eyebrow">{siteContent.reports.eyebrow}</p>
          <h2>{siteContent.reports.headline}</h2>
          <p>{siteContent.reports.description}</p>
        </div>
        <ReportPreviews />
      </section>

      <section className="resources-section resources-section--templates" id="templates">
        <div className="resources-section-heading">
          <p className="site-eyebrow">{siteContent.messageTemplates.eyebrow}</p>
          <h2>{siteContent.messageTemplates.heading}</h2>
          <p>{siteContent.messageTemplates.approvalNote}</p>
        </div>
        <div className="template-list">
          {siteContent.messageTemplates.entries.map((template) => (
            <article className="template-entry" key={template.id}>
              <h3>{template.title}</h3>
              <div className="template-language">
                <div><span>{siteContent.resources.english}</span><p lang="en">{template.en}</p></div>
                <CopyTemplateButton text={template.en} language={siteContent.resources.english} />
              </div>
              <div className="template-language">
                <div><span>{siteContent.resources.hindi}</span><p lang="hi">{template.hi}</p></div>
                <CopyTemplateButton text={template.hi} language={siteContent.resources.hindi} />
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="resources-section resources-section--guides" id="guides">
        <div className="resources-section-heading">
          <p className="site-eyebrow">{siteContent.resources.guidesHeading}</p>
          <h2>Steady follow-up, one week at a time.</h2>
        </div>
        <div className="guide-list">
          {siteContent.guides.map((guide) => (
            <article className="guide-entry" key={guide.id} id={guide.id}>
              <h3>{guide.title}</h3>
              {guide.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
