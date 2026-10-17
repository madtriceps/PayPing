import type { MetadataRoute } from "next";

const routes = ["/", "/demo", "/demo/live", "/demo/clients", "/resources", "/book-demo", "/privacy", "/terms"];

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  return routes.map((route) => ({
    url: new URL(route, baseUrl).toString(),
    changeFrequency: route === "/" ? "weekly" : "monthly",
    priority: route === "/" ? 1 : route === "/demo" ? 0.9 : route === "/demo/live" ? 0.6 : 0.7,
  }));
}
