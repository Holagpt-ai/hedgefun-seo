import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { createServerClient } from "@/lib/supabase";
import type { TickerRow } from "@/types";

const BASE_URL = "https://hedgefun.fun";

export const revalidate = 3600;
export const dynamicParams = true;

export async function generateStaticParams() {
  const supabase = createServerClient();
  const { data } = await supabase
    .from("seo_tickers")
    .select("ticker")
    .eq("type", "etf")
    .limit(500);
  return (data ?? []).map((row) => ({ ticker: row.ticker }));
}

async function getTicker(ticker: string): Promise<TickerRow | null> {
  const supabase = createServerClient();
  const { data } = await supabase
    .from("seo_tickers")
    .select("*")
    .eq("ticker", ticker.toUpperCase())
    .eq("type", "etf")
    .maybeSingle();
  return data as TickerRow | null;
}

export async function generateMetadata({
  params,
}: {
  params: { ticker: string; locale: string };
}): Promise<Metadata> {
  const { ticker, locale } = params;
  const isEs = locale === "es";
  const data = await getTicker(ticker);
  const name = data?.company_name ?? ticker;
  const canonical = `${BASE_URL}/etf/${ticker}`;
  const esCanonical = `${BASE_URL}/es/etf/${ticker}`;

  const title = isEs
    ? (data?.meta_title_es ?? `${name} (${ticker}) Precio y Análisis del ETF | HedgeFun`)
    : (data?.meta_title_en ?? `${name} (${ticker}) ETF Price & Analysis | HedgeFun`);

  const description = isEs
    ? (data?.meta_description_es ??
        `Sigue el precio, composición y rendimiento del ETF ${ticker}. Datos de nivel institucional en HedgeFun.`)
    : (data?.meta_description_en ??
        `Track ${ticker} ETF price, holdings, and performance. Institutional-grade ETF data on HedgeFun.`);

  return {
    title,
    description,
    robots: { index: true, follow: true },
    openGraph: {
      title,
      description,
      url: isEs ? esCanonical : canonical,
      type: "website",
      siteName: "HedgeFun",
      images: [{ url: `${BASE_URL}/og-image.png`, width: 1200, height: 630 }],
    },
    alternates: {
      canonical: isEs ? esCanonical : canonical,
      languages: { en: canonical, es: esCanonical },
    },
  };
}

export default async function EtfPage({
  params,
}: {
  params: { ticker: string; locale: string };
}) {
  setRequestLocale(params.locale);
  const { ticker, locale } = params;
  const isEs = locale === "es";
  const data = await getTicker(ticker);
  if (!data) notFound();

  const name = data.company_name ?? ticker;
  const liveUrl = `${BASE_URL}/etf/${ticker}`;

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "FinancialProduct",
        name: `${name} ETF (${ticker})`,
        description: isEs ? data.description_es : data.description_en,
        url: liveUrl,
        provider: { "@type": "Organization", name: "HedgeFun", url: BASE_URL },
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "ETFs", item: `${BASE_URL}/etfs` },
          { "@type": "ListItem", position: 2, name: `${name} (${ticker})`, item: liveUrl },
        ],
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <main className="max-w-4xl mx-auto px-4 py-8">
        <nav className="text-sm text-gray-500 mb-4">
          <span>ETFs</span>
          <span className="mx-2">/</span>
          <span className="font-medium text-gray-900">{ticker}</span>
        </nav>

        <h1 className="text-2xl font-bold text-gray-900 mb-1">
          {isEs
            ? `Análisis del ETF ${name} (${ticker})`
            : `${name} (${ticker}) ETF Analysis`}
        </h1>

        {data.sector && (
          <p className="text-sm text-gray-500 mb-4">
            {data.sector}{data.exchange ? ` · ${data.exchange}` : ""}
          </p>
        )}

        {(isEs ? data.description_es : data.description_en) && (
          <p className="text-gray-700 mb-6 leading-relaxed">
            {isEs ? data.description_es : data.description_en}
          </p>
        )}

        <a
          href={liveUrl}
          className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold px-6 py-3 rounded-lg transition-colors"
        >
          {isEs ? `Ver datos en vivo del ETF ${ticker} →` : `View live ${ticker} ETF data →`}
        </a>

        <p className="mt-8 text-xs text-gray-400">
          {isEs
            ? "HedgeFun es solo para fines informativos."
            : "HedgeFun is for informational purposes only."}
        </p>
      </main>
    </>
  );
}
