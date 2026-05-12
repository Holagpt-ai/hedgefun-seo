import { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/admin", "/api"],
      },
    ],
    sitemap: [
      "https://seo.hedgefun.fun/sitemap.xml",
      "https://seo.hedgefun.fun/sitemap-index",
    ],
  };
}
