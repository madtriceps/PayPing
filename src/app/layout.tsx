import type { Metadata } from "next";
import { Geist } from "next/font/google";
import { Instrument_Serif } from "next/font/google";
import "./globals.css";
import { SiteFooter, SiteHeader } from "@/components/site-chrome";
import { siteContent } from "@/content/site";

const geist = Geist({
  subsets: ["latin"],
  variable: "--font-geist",
});
const instrumentSerif = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
  variable: "--font-instrument",
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  title: { default: siteContent.metadata.title, template: "%s" },
  description: siteContent.metadata.description,
  openGraph: {
    title: siteContent.metadata.title,
    description: siteContent.metadata.openGraphDescription,
    type: "website",
    images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: "PayPing — Get paid. Don't chase." }],
  },
  twitter: {
    card: "summary_large_image",
    title: siteContent.metadata.title,
    description: siteContent.metadata.openGraphDescription,
    images: ["/opengraph-image"],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const contactEmail = process.env.CONTACT_EMAIL ?? "";
  return (
    <html lang="en">
      <body className={`${geist.variable} ${instrumentSerif.variable}`}>
        <SiteHeader />
        {children}
        <SiteFooter contactEmail={contactEmail} />
      </body>
    </html>
  );
}
