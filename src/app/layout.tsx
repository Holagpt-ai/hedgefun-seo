import type { Metadata } from "next";
import "./globals.css";

const BASE_URL = "https://seo.hedgefun.fun";

export const metadata: Metadata = {
  metadataBase: new URL(BASE_URL),
  title: "HedgeFun | Stock Analysis, Screening & Market Data",
  description:
    "Institutional-grade stock analysis, screening, and market data for self-directed investors. Real-time prices, financials, earnings, and more.",
  icons: {
    icon: `${BASE_URL}/favicon.ico`,
    shortcut: `${BASE_URL}/favicon.ico`,
    apple: `${BASE_URL}/favicon.ico`,
  },
  openGraph: {
    title: "HedgeFun | Stock Analysis & Market Data",
    description:
      "Institutional-grade stock analysis for self-directed investors.",
    url: BASE_URL,
    siteName: "HedgeFun",
    images: [{ url: `${BASE_URL}/og-image.png`, width: 1200, height: 630 }],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    site: "@HedgeFun",
    images: [`${BASE_URL}/og-image.png`],
  },
  alternates: {
    canonical: BASE_URL,
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const organizationJsonLd = {
    "@context": "https://schema.org",
    "@type": "FinancialService",
    name: "HedgeFun",
    url: BASE_URL,
    logo: `${BASE_URL}/og-image.png`,
    description:
      "Institutional-grade stock analysis and market data for self-directed investors.",
    sameAs: ["https://twitter.com/HedgeFun"],
  };

  return (
    <html lang="en">
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(organizationJsonLd),
          }}
        />
        <script
          async
          src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-4855396891178044"
          crossOrigin="anonymous"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}