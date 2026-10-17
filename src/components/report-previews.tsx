import Link from "next/link";
import { siteContent } from "@/content/site";
import { PayPingIcon } from "@/components/icons";

const money = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 });
const percent = new Intl.NumberFormat("en-IN", { style: "percent", maximumFractionDigits: 0 });
const clients = siteContent.insights.clients;
const reportFiles = [
  "weekly-collections-summary.pdf",
  "receivables-aging.pdf",
  "client-payment-behaviour.pdf",
];

function SampleStamp() {
  return <span className="report-sample-stamp"><PayPingIcon name="Report" size={14} />{siteContent.reports.sample}</span>;
}

function ReportBody({ index }: { index: number }) {
  if (index === 0) {
    return (
      <div className="report-paper__body">
        <div className="report-summary-values">
          {siteContent.reports.weeklyRows.map((row) => <p key={row.label}><small>{row.label}</small><strong>{row.value}</strong></p>)}
        </div>
        <h4>{siteContent.reports.topChaseLabel}</h4>
        <table><thead><tr><th>{siteContent.reports.client}</th><th>Invoice</th><th>Amount</th><th>Due</th></tr></thead><tbody>
          {siteContent.reports.topChaseInvoices.map((invoice) => (
            <tr key={invoice.invoiceNumber}><th>{invoice.name}</th><td>{invoice.invoiceNumber}</td><td>{money.format(invoice.amountPaise / 100)}</td><td>{invoice.dueLabel}</td></tr>
          ))}
        </tbody></table>
        <p className="report-note">{siteContent.reports.weeklyFootnote}</p>
      </div>
    );
  }
  if (index === 1) {
    return (
      <div className="report-paper__body">
        <table><thead><tr><th>Age</th><th>Open invoices</th><th>Outstanding</th><th>Clients in this group</th></tr></thead><tbody>
          {siteContent.aging.buckets.map((bucket) => (
            <tr key={bucket.label}>
              <th>{bucket.label}</th>
              <td>{bucket.invoiceCount}</td>
              <td>{money.format(bucket.amountRupees)}</td>
              <td>{bucket.clients.map((client) => client.name).join(", ")}</td>
            </tr>
          ))}
        </tbody></table>
        <p className="report-note">{siteContent.reports.agingFootnote}</p>
      </div>
    );
  }
  return (
    <div className="report-paper__body">
      <table><thead><tr><th>{siteContent.reports.client}</th><th>{siteContent.reports.averageLate}</th><th>{siteContent.reports.onTimeRate}</th><th>{siteContent.reports.basedOn}</th></tr></thead><tbody>
        {clients.map((client) => (
          <tr key={client.name}>
            <th>{client.name}</th>
            <td>{client.avgDaysLate < 0
              ? `${Math.abs(Math.round(client.avgDaysLate))} ${siteContent.reports.daysEarly}`
              : `${Math.round(client.avgDaysLate)} ${siteContent.reports.daysLate}`}</td>
            <td>{percent.format(client.onTimeRate)}</td>
            <td>{client.paidCount} {siteContent.reports.invoiceCount}</td>
          </tr>
        ))}
      </tbody></table>
      <p className="report-note">{siteContent.reports.behaviourFootnote}</p>
    </div>
  );
}

export function ReportPreviews({ showLinks = true }: { showLinks?: boolean }) {
  return (
    <div className="report-preview-list">
      {siteContent.reportsPage.reports.map((report, index) => (
        <article className={`report-preview report-preview--${index + 1}`} id={`report-${report.id}`} key={report.id}>
          <div className="report-preview__heading">
            <div><SampleStamp /><h3>{report.title}</h3><p>{report.summary}</p></div>
            {showLinks && <div className="report-preview__actions">
              <Link href={`/resources#report-${report.id}`}>{siteContent.reports.openSample}</Link>
              <a href={`/samples/${reportFiles[index]}`} download>{siteContent.reports.downloadPdf}</a>
            </div>}
          </div>
          <div className="report-paper">
            <div className="report-paper__header"><strong>payping</strong><span>{report.title}</span></div>
            <ReportBody index={index} />
          </div>
        </article>
      ))}
    </div>
  );
}

export function ReportsSection() {
  return (
    <section className="reports-section" id="reports">
      <p className="site-eyebrow">{siteContent.reports.eyebrow}</p>
      <div className="reports-section__heading">
        <div><h2>{siteContent.reports.headline}</h2><p>{siteContent.reports.description}</p></div>
        <Link href="/resources">{siteContent.navigation.reports}<PayPingIcon name="Arrow" size={16} /></Link>
      </div>
      <ReportPreviews />
    </section>
  );
}
