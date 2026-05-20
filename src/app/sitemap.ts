import { MetadataRoute } from "next";

const BASE_URL = "https://seo.hedgefun.fun";

export const revalidate = 86400;

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: `${BASE_URL}/sitemap-index`, lastModified: new Date(), changeFrequency: "daily", priority: 1.0 },
  ];
}
