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

  const ed = (data.entity_data as Record<string, unknown>) ?? {};
  const employees = (ed.employees as number | null) ?? (data.employees as number | null) ?? null;
  const ceo = (ed.ceo as string | null) ?? null;
  const founded = (ed.founded as string | null) ?? null;
  const headquarters = (ed.headquarters as string | null) ?? null;
  const website = (ed.website as string | null) ?? null;
  const websiteDisplay = website ? website.replace(/^https?:\/\//, "").replace(/\/$/, "") : null;

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <header className="bg-white border-b border-gray-200">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-md bg-blue-700 flex items-center justify-center text-white text-xs font-semibold">
              HF
            </div>
            <a href="https://hedgefun.fun" className="text-blue-700 font-semibold text-base">
              HedgeFun
            </a>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <a
              href={`/en/stocks/${ticker}`}
              className={!isEs ? "text-blue-700 font-semibold" : "text-gray-400 hover:text-gray-600"}
            >
              EN
            </a>
            <span className="text-gray-300">|</span>
            <a
              href={`/es/stocks/${ticker}`}
              className={isEs ? "text-blue-700 font-semibold" : "text-gray-400 hover:text-gray-600"}
            >
              ES
            </a>
          </div>
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

        <div className="bg-white border border-gray-100 rounded-xl p-5 mb-4">
          <div className="flex items-start justify-between flex-wrap gap-3">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-2xl font-semibold text-gray-900">{name}</h1>
                <span className="text-xs font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded">
                  {ticker}
                </span>
                {data.exchange && (
                  <span className="text-xs font-semibold text-teal-700 bg-teal-50 px-2 py-0.5 rounded">
                    {resolveExchange(data.exchange)}
                  </span>
                )}
              </div>
              {(data.sector || data.industry) && (
                <p className="text-sm text-gray-500 mt-1">
                  {data.sector ?? ""}
                  {data.industry && data.industry !== data.sector ? ` · ${data.industry}` : ""}
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="w-full flex justify-center my-4">
          <ins
            className="adsbygoogle"
            style={{ display: "block" }}
            data-ad-client="ca-pub-4855396891178044"
            data-ad-slot="1234567890"
            data-ad-format="auto"
            data-full-width-responsive="true"
          />
        </div>

        <div className="bg-white border border-gray-100 rounded-xl p-5 mb-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-4">
            {data.market_cap && (
              <div>
                <p className="text-xs text-gray-500 mb-1">{isEs ? "Cap. de mercado" : "Market cap"}</p>
                <p className="text-base font-semibold text-gray-900">{formatMarketCap(data.market_cap)}</p>
              </div>
            )}
            {employees && (
              <div>
                <p className="text-xs text-gray-500 mb-1">{isEs ? "Empleados" : "Employees"}</p>
                <p className="text-base font-semibold text-gray-900">{Number(employees).toLocaleString()}</p>
              </div>
            )}
            {data.exchange && (
              <div>
                <p className="text-xs text-gray-500 mb-1">{isEs ? "Bolsa" : "Exchange"}</p>
                <p className="text-base font-semibold text-gray-900">{resolveExchange(data.exchange)}</p>
              </div>
            )}
            {ceo && (
              <div>
                <p className="text-xs text-gray-500 mb-1">CEO</p>
                <p className="text-base font-semibold text-gray-900">{ceo}</p>
              </div>
            )}
            {founded && (
              <div>
                <p className="text-xs text-gray-500 mb-1">{isEs ? "Fundada" : "Founded"}</p>
                <p className="text-base font-semibold text-gray-900">{founded}</p>
              </div>
            )}
            {headquarters && (
              <div>
                <p className="text-xs text-gray-500 mb-1">{isEs ? "Sede" : "Headquarters"}</p>
                <p className="text-base font-semibold text-gray-900">{headquarters}</p>
              </div>
            )}
          </div>
        </div>

        {(isEs ? data.description_es : data.description_en) && (
          <div className="bg-white border border-gray-100 rounded-xl p-5 mb-4">
            <h2 className="text-base font-semibold text-gray-900 mb-3">
              {isEs ? `Acerca de ${name}` : `About ${name}`}
            </h2>
            <p className="text-sm text-gray-600 leading-relaxed mb-4">
              {isEs ? data.description_es : data.description_en}
            </p>
            <div className="grid grid-cols-2 gap-x-6 gap-y-3 border-t border-gray-100 pt-4">
              {data.industry && (
                <div>
                  <p className="text-xs text-gray-500 mb-0.5">{isEs ? "Industria" : "Industry"}</p>
                  <p className="text-sm font-semibold text-gray-900">{data.industry}</p>
                </div>
              )}
              {data.sector && (
                <div>
                  <p className="text-xs text-gray-500 mb-0.5">{isEs ? "Sector" : "Sector"}</p>
                  <p className="text-sm font-semibold text-gray-900">{data.sector}</p>
                </div>
              )}
              {data.country && (
                <div>
                  <p className="text-xs text-gray-500 mb-0.5">{isEs ? "País" : "Country"}</p>
                  <p className="text-sm font-semibold text-gray-900">{data.country}</p>
                </div>
              )}
              {websiteDisplay && (
                <div>
                  <p className="text-xs text-gray-500 mb-0.5">{isEs ? "Sitio web" : "Website"}</p>
                  <a
                    href={website!}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm font-semibold text-blue-700 hover:underline"
                  >
                    {websiteDisplay}
                  </a>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="w-full flex justify-center my-4">
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
          <div className="bg-white border border-gray-100 rounded-xl overflow-hidden mb-4">
            <div className="px-5 py-4 border-b border-gray-100">
              <h2 className="text-base font-semibold text-gray-900">
                {isEs ? `Noticias de ${ticker}` : `${ticker} news`}
              </h2>
            </div>
            <div className="divide-y divide-gray-100">
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
                  <div key={article.slug} className="px-5 py-4 hover:bg-gray-50 transition-colors">
                    <a
                      href={`${BASE_URL}/news/${article.slug}`}
                      className="text-sm font-semibold text-blue-700 hover:underline leading-snug block mb-1"
                    >
                      {title}
                    </a>
                    {summary && (
                      <p className="text-xs text-gray-500 leading-relaxed mb-1 line-clamp-2">{summary}</p>
                    )}
                    <p className="text-xs text-gray-400">
                      {article.source}{pubDate ? ` · ${pubDate}` : ""}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="flex justify-center mb-4">
          <a
            href={liveUrl}
            className="inline-flex items-center justify-center gap-2 bg-blue-700 hover:bg-blue-800 text-white font-semibold px-8 py-3 rounded-lg transition-colors text-sm w-full sm:w-auto"
          >
            {isEs ? `Ver análisis completo de ${ticker} →` : `View full ${ticker} analysis →`}
          </a>
        </div>

        <div className="w-full flex justify-center my-4">
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

      <footer className="bg-slate-900 text-white mt-4">
        <div className="max-w-5xl mx-auto px-4 pt-8 pb-6">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-8 mb-8">
            <div>
              <p className="text-xs font-semibold text-white uppercase tracking-wider mb-3">
                {isEs ? "Secciones" : "Sections"}
              </p>
              <div className="flex flex-col gap-2">
                <a href="https://hedgefun.fun/stocks" className="text-sm text-slate-400 hover:text-white transition-colors">
                  {isEs ? "Acciones" : "Stocks"}
                </a>
                <a href="https://hedgefun.fun/etf" className="text-sm text-slate-400 hover:text-white transition-colors">
                  ETFs
                </a>
                <a href="https://hedgefun.fun/ipo" className="text-sm text-slate-400 hover:text-white transition-colors">
                  IPOs
                </a>
                <a href="https://hedgefun.fun/news" className="text-sm text-slate-400 hover:text-white transition-colors">
                  {isEs ? "Noticias" : "News"}
                </a>
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold text-white uppercase tracking-wider mb-3">
                {isEs ? "Listas" : "Stock lists"}
              </p>
              <div className="flex flex-col gap-2">
                <a href={`${BASE_URL}/stocks/lists/sp500`} className="text-sm text-slate-400 hover:text-white transition-colors">S&amp;P 500</a>
                <a href={`${BASE_URL}/stocks/lists/nasdaq100`} className="text-sm text-slate-400 hover:text-white transition-colors">Nasdaq 100</a>
                <a href={`${BASE_URL}/stocks/lists/dowjones`} className="text-sm text-slate-400 hover:text-white transition-colors">Dow Jones</a>
                <a href={`${BASE_URL}/stocks/lists/faang`} className="text-sm text-slate-400 hover:text-white transition-colors">FAANG</a>
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold text-white uppercase tracking-wider mb-3">
                {isEs ? "Empresa" : "Company"}
              </p>
              <div className="flex flex-col gap-2">
                <a href="https://hedgefun.fun/about" className="text-sm text-slate-400 hover:text-white transition-colors">
                  {isEs ? "Acerca de" : "About"}
                </a>
                <a href="https://hedgefun.fun/privacy" className="text-sm text-slate-400 hover:text-white transition-colors">
                  {isEs ? "Privacidad" : "Privacy policy"}
                </a>
                <a href="https://hedgefun.fun/terms" className="text-sm text-slate-400 hover:text-white transition-colors">
                  {isEs ? "Términos" : "Terms of use"}
                </a>
                <a href={`${BASE_URL}/sitemap.xml`} className="text-sm text-slate-400 hover:text-white transition-colors">
                  Sitemap
                </a>
              </div>
            </div>
          </div>
          <div className="border-t border-slate-800 pt-5 flex items-center justify-between flex-wrap gap-2">
            <p className="text-xs text-slate-500">
              © {new Date().getFullYear()} HedgeFun.fun ·{" "}
              {isEs
                ? "Solo para fines informativos. No constituye asesoramiento financiero."
                : "For informational purposes only. Not financial advice."}
            </p>
            <p className="text-xs text-slate-500">seo.hedgefun.fun</p>
          </div>
        </div>
      </footer>
    </>
  );
}