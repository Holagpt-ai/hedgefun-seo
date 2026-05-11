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
      "https://hedgefun.fun/sitemap.xml",
      "https://hedgefun.fun/sitemap-index",
    ],
  };
}
