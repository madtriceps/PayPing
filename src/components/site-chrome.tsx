"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { PayPingIcon } from "@/components/icons";
import { PingMark } from "@/components/ping-mark";
import { siteContent } from "@/content/site";

const headerLinks = [
  { label: siteContent.navigation.product, href: "/#product" },
  { label: siteContent.navigation.howItWorks, href: "/#how-it-works" },
  { label: siteContent.navigation.reports, href: "/resources" },
  { label: siteContent.navigation.pricing, href: "/#pricing" },
  { label: siteContent.navigation.faq, href: "/#faq" },
];

export function SiteHeader() {
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (!menuOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [menuOpen]);

  function closeMenu() {
    setMenuOpen(false);
  }

  return (
    <header className="site-header">
      <div className="site-header-inner">
        <Link className="site-brand" href="/" aria-label="PayPing home" onClick={closeMenu}>
          <PingMark state="waiting" size={30} /><span>payping</span>
        </Link>
        <nav className="site-nav" aria-label="Main navigation">
          {headerLinks.map((link) => <Link key={link.href} href={link.href}>{link.label}</Link>)}
          <Link className="site-nav-demo" href="/demo">{siteContent.navigation.liveDemo}</Link>
          <Link className="site-nav-primary" href="/book-demo">{siteContent.navigation.book}</Link>
        </nav>
        <button
          className="mobile-menu-toggle"
          type="button"
          aria-expanded={menuOpen}
          aria-controls="mobile-navigation"
          aria-label={menuOpen ? "Close menu" : "Open menu"}
          onClick={() => setMenuOpen((open) => !open)}
        >
          {menuOpen ? <PayPingIcon name="Close" size={21} /> : <span className="menu-lines" aria-hidden="true"><i /><i /></span>}
        </button>
      </div>
      <div className={`mobile-navigation${menuOpen ? " mobile-navigation--open" : ""}`} id="mobile-navigation" aria-hidden={!menuOpen}>
        <nav aria-label="Mobile navigation" inert={!menuOpen}>
          {headerLinks.map((link, index) => (
            <Link key={link.href} href={link.href} onClick={closeMenu}><span>{String(index + 1).padStart(2, "0")}</span>{link.label}<PayPingIcon name="Arrow" size={17} /></Link>
          ))}
          <Link href="/demo" onClick={closeMenu}><span>06</span>{siteContent.navigation.liveDemo}<PayPingIcon name="Arrow" size={17} /></Link>
          <Link className="mobile-navigation-primary" href="/book-demo" onClick={closeMenu}>{siteContent.navigation.book}<PayPingIcon name="Arrow" size={17} /></Link>
        </nav>
      </div>
    </header>
  );
}

export function SiteFooter({ contactEmail }: { contactEmail: string }) {
  return (
    <footer className="site-footer">
      <div className="site-footer-main">
        <div className="footer-brand">
          <Link className="site-brand" href="/" aria-label="PayPing home"><PingMark state="waiting" size={31} /><span>payping</span></Link>
          <p>Clear invoices. Considerate follow-up.</p>
        </div>
        <div className="footer-links">
          <div>
            <strong className="footer-heading">Product</strong>
            <Link href="/#how-it-works">{siteContent.footer.howItWorks}</Link>
            <Link href="/demo">{siteContent.footer.liveDemo}</Link>
            <Link href="/#pricing">{siteContent.footer.pricing}</Link>
          </div>
          <div>
            <strong className="footer-heading">Resources</strong>
            <Link href="/resources">{siteContent.footer.sampleReports}</Link>
            <Link href="/resources#templates">{siteContent.footer.templates}</Link>
            <Link href="/resources#guides">{siteContent.footer.guides}</Link>
          </div>
          <div>
            <strong className="footer-heading">Company</strong>
            <Link href="/book-demo">{siteContent.footer.book}</Link>
            <Link href="/privacy">{siteContent.footer.privacy}</Link>
            <Link href="/terms">{siteContent.footer.terms}</Link>
          </div>
          {contactEmail && <div><strong className="footer-heading">Email</strong><a href={`mailto:${contactEmail}`}>{contactEmail}</a></div>}
        </div>
      </div>
      <div className="site-footer-bottom">
        <span>{siteContent.footer.disclaimer}</span>
        <span>© {new Date().getFullYear()} PayPing</span>
      </div>
    </footer>
  );
}
