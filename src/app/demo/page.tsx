import type { Metadata } from "next";
import { GuidedDemo } from "@/components/guided-demo";
import { siteContent } from "@/content/site";

export const metadata: Metadata = {
  title: "Live demo | PayPing",
  description: siteContent.guidedDemo.description,
};

export default function GuidedDemoPage() {
  return <GuidedDemo />;
}
