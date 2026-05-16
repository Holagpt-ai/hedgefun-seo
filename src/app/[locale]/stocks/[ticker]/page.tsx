import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { createServerClient } from "@/lib/supabase";
import type { TickerRow } from "@/types";

const BASE_URL = "https://seo.hedgefun.fun";
const PAGE_SIZE = 1000;

export const revalidate = 3600;
export const dynamicParams = true;

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

function formatMarketCap(value: number): string {
  if (value >= 1e12) return `$${(value / 1e12).toFixed(2)}T`;
  if (value >= 1e9) return `$${(value / 1e9).toFixed(2)}B`;
  if (value >= 1e6) return `$${(value / 1e6).toFixed(2)}M`;
  return `$${value.toLocaleString()}`;
}

const EXCHANGE_LABELS: Record<string, string> = {
  XNAS: "NASDAQ",
  XNYS: "NYSE",
  XASE: "NYSE American",
  ARCX: "NYSE Arca",
  BATS: "CBOE BZX",
  XOTC: "OTC",
};

function resolveExchange(mic: string): string {
  return EXCHANGE_LABELS[mic] ?? mic;
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

  const supabase = createServerClient();
  const { data: news } = await supabase
    .from("seo_news")
    .select("slug, ticker, title_en, title_es, summary_en, summary_es, source, source_url, published_at")
    .eq("ticker", ticker.toUpperCase())
    .order("published_at", { ascending: false })
    .limit(5);

  const name = data.company_name ?? ticker;
  const liveUrl = `https://hedgefun.fun/stocks/${ticker}`;

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

      <header className="bg-white border-b border-gray-200">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-3">
          <a href="https://hedgefun.fun" className="text-blue-700 font-bold text-lg tracking-tight">
            HedgeFun
          </a>
          <span className="text-gray-300">|</span>
          <span className="text-sm text-gray-500">
            {isEs ? "Análisis de Acciones" : "Stock Analysis"}
          </span>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6">

        <nav className="text-sm text-gray-500 mb-4" aria-label="Breadcrumb">
          <a href={`${BASE_URL}/stocks`} className="hover:text-blue-700 transition-colors">
            {isEs ? "Acciones" : "Stocks"}
          </a>
          <span className="mx-2 text-gray-300">/</span>
          <span className="text-gray-900 font-medium">{ticker}</span>
        </nav>

        <div className="mb-2">
          <h1 className="text-3xl font-bold text-gray-900 leading-tight">
            {name}
            <span className="ml-3 text-lg font-medium text-gray-400 bg-gray-100 px-2 py-0.5 rounded">
              {ticker}
            </span>
          </h1>
        </div>

        {(data.sector || data.exchange) && (
          <p className="text-sm text-gray-500 mb-5">
            {data.sector ?? ""}
            {data.industry && data.industry !== data.sector ? ` · ${data.industry}` : ""}
            {data.exchange ? ` · ${resolveExchange(data.exchange)}` : ""}
          </p>
        )}

        <div className="w-full flex justify-center my-5">
          <ins
            className="adsbygoogle"
            style={{ display: "block" }}
            data-ad-client="ca-pub-4855396891178044"
            data-ad-slot="1234567890"
            data-ad-format="auto"
            data-full-width-responsive="true"
          />
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 mb-6">
          {data.market_cap && (
            <div className="bg-gray-50 border border-gray-100 rounded-lg p-4">
              <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">
                {isEs ? "Cap. de Mercado" : "Market Cap"}
              </p>
              <p className="text-base font-semibold text-gray-900">
                {formatMarketCap(data.market_cap)}
              </p>
            </div>
          )}
          {data.employees && (
            <div className="bg-gray-50 border border-gray-100 rounded-lg p-4">
              <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">
                {isEs ? "Empleados" : "Employees"}
              </p>
              <p className="text-base font-semibold text-gray-900">
                {Number(data.employees).toLocaleString()}
              </p>
            </div>
          )}
          {data.exchange && (
            <div className="bg-gray-50 border border-gray-100 rounded-lg p-4">
              <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">
                {isEs ? "Bolsa" : "Exchange"}
              </p>
              <p className="text-base font-semibold text-gray-900">
                {resolveExchange(data.exchange)}
              </p>
            </div>
          )}
          {data.sector && (
            <div className="bg-gray-50 border border-gray-100 rounded-lg p-4">
              <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">
                {isEs ? "Sector" : "Sector"}
              </p>
              <p className="text-base font-semibold text-gray-900 truncate">
                {data.sector}
              </p>
            </div>
          )}
        </div>

        {(isEs ? data.description_es : data.description_en) && (
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-2">
              {isEs ? `Acerca de ${name}` : `About ${name}`}
            </h2>
            <p className="text-gray-700 leading-relaxed text-base">
              {isEs ? data.description_es : data.description_en}
            </p>
          </div>
        )}

        <div className="w-full flex justify-center my-5">
          <ins
            className="adsbygoogle"
            style={{ display: "block" }}
            data-ad-client="ca-pub-4855396891178044"
            data-ad-slot="0987654321"
            data-ad-format="auto"
            data-full-width-responsive="true"
          />
        </div>

        {news && news.length > 0 && (
          <div className="mb-8">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              {isEs ? `Noticias de ${ticker}` : `${ticker} News`}
            </h2>
            <div className="divide-y divide-gray-100 border border-gray-100 rounded-lg overflow-hidden">
              {news.map((article) => {
                const title = isEs ? article.title_es : article.title_en;
                const summary = isEs ? article.summary_es : article.summary_en;
                const pubDate = article.published_at
                  ? new Date(article.published_at).toLocaleDateString(
                      isEs ? "es-MX" : "en-US",
                      { month: "short", day: "numeric", year: "numeric" }
                    )
                  : "";
                return (
                  <div key={article.slug} className="bg-white px-4 py-4 hover:bg-gray-50 transition-colors">
                    <a
                      href={`${BASE_URL}/news/${article.slug}`}
                      className="text-blue-700 font-medium text-base hover:underline leading-snug block mb-1"
                    >
                      {title}
                    </a>
                    {summary && (
                      <p className="text-sm text-gray-600 leading-relaxed mb-2 line-clamp-2">
                        {summary}
                      </p>
                    )}
                    <p className="text-xs text-gray-400">
                      {article.source}
                      {pubDate ? ` · ${pubDate}` : ""}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="flex justify-center mb-8">
          <a
            href={liveUrl}
            className="inline-flex items-center gap-2 bg-blue-700 hover:bg-blue-800 text-white font-semibold px-8 py-3 rounded-lg transition-colors text-base w-full sm:w-auto justify-center"
          >
            {isEs
              ? `Ver análisis completo de ${ticker} →`
              : `View full ${ticker} analysis →`}
          </a>
        </div>

        <div className="w-full flex justify-center my-5">
          <ins
            className="adsbygoogle"
            style={{ display: "block" }}
            data-ad-client="ca-pub-4855396891178044"
            data-ad-slot="1122334455"
            data-ad-format="auto"
            data-full-width-responsive="true"
          />
        </div>

      </main>

      <footer className="bg-slate-900 text-white mt-8">
        <div className="max-w-5xl mx-auto px-4 py-6 text-center">
          <p className="text-sm text-slate-300 mb-1">
            © {new Date().getFullYear()} HedgeFun ·{" "}
            {isEs
              ? "Solo para fines informativos. No constituye asesoramiento financiero."
              : "For informational purposes only. Not financial advice."}
          </p>
          <a
            href="https://hedgefun.fun"
            className="text-sm text-blue-400 hover:text-blue-300 transition-colors"
          >
            hedgefun.fun
          </a>
        </div>
      </footer>
    </>
  );
}