import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { createServerClient } from "@/lib/supabase";
import type { TickerRow } from "@/types";

const BASE_URL = "https://seo.hedgefun.fun";
const PAGE_SIZE = 1000;

export const revalidate = 3600; // Revalidate every hour
export const dynamicParams = true;

// Pre-generate top 1,000 stocks at build time; rest on-demand
export async function generateStaticParams() {
  const supabase = createServerClient();
  const { data } = await supabase
    .from("seo_tickers")
    .select("ticker")
    .eq("type", "stock")
    .order("market_cap", { ascending: false })
    .limit(PAGE_SIZE);

  return (data ?? []).map((row) => ({ ticker: row.ticker }));
}

async function getTicker(ticker: string): Promise<TickerRow | null> {
  const supabase = createServerClient();
  const { data } = await supabase
    .from("seo_tickers")
    .select("*")
    .eq("ticker", ticker.toUpperCase())
    .eq("type", "stock")
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
  const canonical = `${BASE_URL}/stocks/${ticker}`;
  const esCanonical = `${BASE_URL}/es/stocks/${ticker}`;

  const title = isEs
    ? (data?.meta_title_es ?? `${name} (${ticker}) Precio y Análisis | HedgeFun`)
    : (data?.meta_title_en ?? `${name} (${ticker}) Stock Price & Analysis | HedgeFun`);

  const description = isEs
    ? (data?.meta_description_es ??
        `Precio en tiempo real de ${ticker}, análisis, finanzas y noticias de ${name}. Datos institucionales en HedgeFun.`)
    : (data?.meta_description_en ??
        `Get real-time ${ticker} stock price, analysis, financials, and news for ${name}. Institutional-grade data on HedgeFun.`);

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
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [`${BASE_URL}/og-image.png`],
    },
    alternates: {
      canonical: isEs ? esCanonical : canonical,
      languages: {
        en: canonical,
        es: esCanonical,
      },
    },
  };
}

export default async function StockPage({
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
  const liveUrl = `https://hedgefun.fun/stocks/${ticker}`;

  // JSON-LD — FinancialInstrument + BreadcrumbList
  const jsonLd = data.schema_json ?? {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "FinancialProduct",
        name: `${name} (${ticker})`,
        description: isEs ? data.description_es : data.description_en,
        url: liveUrl,
        provider: {
          "@type": "Organization",
          name: "HedgeFun",
          url: BASE_URL,
        },
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          {
            "@type": "ListItem",
            position: 1,
            name: isEs ? "Acciones" : "Stocks",
            item: `${BASE_URL}/stocks`,
          },
          {
            "@type": "ListItem",
            position: 2,
            name: `${name} (${ticker})`,
            item: liveUrl,
          },
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
        {/* Header */}
        <nav className="text-sm text-gray-500 mb-4">
          <span>{isEs ? "Acciones" : "Stocks"}</span>
          <span className="mx-2">/</span>
          <span className="font-medium text-gray-900">{ticker}</span>
        </nav>

        <h1 className="text-2xl font-bold text-gray-900 mb-1">
          {isEs
            ? `Análisis de ${name} (${ticker})`
            : `${name} (${ticker}) Stock Analysis`}
        </h1>

        {data.sector && (
          <p className="text-sm text-gray-500 mb-4">
            {data.sector}
            {data.industry ? ` · ${data.industry}` : ""}
            {data.exchange ? ` · ${data.exchange}` : ""}
          </p>
        )}

        {/* Description */}
        {(isEs ? data.description_es : data.description_en) && (
          <p className="text-gray-700 mb-6 leading-relaxed">
            {isEs ? data.description_es : data.description_en}
          </p>
        )}

        {/* Key facts */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-8">
          {data.market_cap && (
            <div className="bg-gray-50 rounded-lg p-4">
              <p className="text-xs text-gray-500 uppercase tracking-wide">
                {isEs ? "Cap. de mercado" : "Market Cap"}
              </p>
              <p className="text-base font-semibold text-gray-900">
                ${(data.market_cap / 1e9).toFixed(2)}B
              </p>
            </div>
          )}
          {data.employees && (
            <div className="bg-gray-50 rounded-lg p-4">
              <p className="text-xs text-gray-500 uppercase tracking-wide">
                {isEs ? "Empleados" : "Employees"}
              </p>
              <p className="text-base font-semibold text-gray-900">
                {data.employees.toLocaleString()}
              </p>
            </div>
          )}
          {data.exchange && (
            <div className="bg-gray-50 rounded-lg p-4">
              <p className="text-xs text-gray-500 uppercase tracking-wide">
                {isEs ? "Bolsa" : "Exchange"}
              </p>
              <p className="text-base font-semibold text-gray-900">
                {data.exchange}
              </p>
            </div>
          )}
        </div>

        {/* CTA */}
        <a
          href={liveUrl}
          className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold px-6 py-3 rounded-lg transition-colors"
        >
          {isEs
            ? `Ver análisis en vivo de ${ticker} →`
            : `View live ${ticker} analysis →`}
        </a>

        <p className="mt-8 text-xs text-gray-400">
          {isEs
            ? "HedgeFun es solo para fines informativos y no constituye asesoramiento financiero."
            : "HedgeFun is for informational purposes only and does not constitute financial advice."}
        </p>
      </main>
    </>
  );
}
