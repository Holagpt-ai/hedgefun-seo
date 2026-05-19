import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { createServerClient } from "@/lib/supabase";

const BASE_URL = "https://seo.hedgefun.fun";

export const revalidate = 86400;
export const dynamicParams = false;

function slugify(str: string): string {
  return str
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

const EXCHANGE_LABELS: Record<string, string> = {
  XNAS: "NASDAQ",
  XNYS: "NYSE",
  XASE: "NYSE American",
  ARCX: "NYSE Arca",
  BATS: "CBOE BZX",
  XOTC: "OTC",
};

function resolveExchange(mic: string | null): string {
  if (!mic) return "—";
  return EXCHANGE_LABELS[mic] ?? mic;
}

function formatMarketCap(value: number | null): string {
  if (!value) return "—";
  if (value >= 1e12) return `$${(value / 1e12).toFixed(2)}T`;
  if (value >= 1e9) return `$${(value / 1e9).toFixed(2)}B`;
  if (value >= 1e6) return `$${(value / 1e6).toFixed(2)}M`;
  return `$${value.toLocaleString()}`;
}

async function getAllIndustries(): Promise<string[]> {
  const supabase = createServerClient();
  const { data } = await supabase
    .from("seo_tickers")
    .select("industry")
    .eq("type", "stock")
    .not("industry", "is", null)
    .order("industry");
  if (!data) return [];
  return Array.from(new Set(data.map((r) => r.industry as string)));
}

function resolveIndustryLabel(slug: string, allIndustries: string[]): string | null {
  return allIndustries.find((ind) => slugify(ind) === slug) ?? null;
}

export async function generateStaticParams() {
  const industries = await getAllIndustries();
  const locales = ["en", "es"];
  const seen = new Set<string>();
  const params: { industry: string; locale: string }[] = [];
  for (const ind of industries) {
    const slug = slugify(ind);
    if (!seen.has(slug)) {
      seen.add(slug);
      for (const locale of locales) {
        params.push({ industry: slug, locale });
      }
    }
  }
  return params;
}

async function getIndustryStocks(industryLabel: string) {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("seo_tickers")
    .select("ticker, company_name, sector, industry, market_cap, exchange")
    .eq("type", "stock")
    .eq("industry", industryLabel)
    .order("market_cap", { ascending: false })
    .limit(500);
  if (error) return [];
  return data ?? [];
}

export async function generateMetadata({
  params,
}: {
  params: { industry: string; locale: string };
}): Promise<Metadata> {
  const { industry: slug, locale } = params;
  const isEs = locale === "es";
  const allIndustries = await getAllIndustries();
  const label = resolveIndustryLabel(slug, allIndustries);
  if (!label) return {};
  const supabase = createServerClient();
  const { data: sectorRow } = await supabase
    .from("seo_tickers")
    .select("sector")
    .eq("industry", label)
    .eq("type", "stock")
    .not("sector", "is", null)
    .limit(1)
    .maybeSingle();
  const sector = sectorRow?.sector ?? null;
  const title = isEs
    ? `Acciones de ${label} — Lista Completa y Análisis | HedgeFun`
    : `${label} Stocks — Full List & Analysis | HedgeFun`;
  const description = isEs
    ? `Explora todas las acciones de la industria ${label}${sector ? ` en el sector ${sector}` : ""}. Ordenadas por capitalización de mercado en HedgeFun.`
    : `Browse all ${label} stocks${sector ? ` in the ${sector} sector` : ""}. Sorted by market cap with exchange data. Powered by HedgeFun.`;
  const canonical = `${BASE_URL}/en/stocks/industry/${slug}`;
  const esCanonical = `${BASE_URL}/es/stocks/industry/${slug}`;
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

const SECTOR_SLUGS: { slug: string; labelEn: string; labelEs: string }[] = [
  { slug: "technology", labelEn: "Technology", labelEs: "Tecnología" },
  { slug: "financials", labelEn: "Financials", labelEs: "Finanzas" },
  { slug: "healthcare", labelEn: "Healthcare", labelEs: "Salud" },
  { slug: "industrials", labelEn: "Industrials", labelEs: "Industriales" },
  { slug: "consumer-staples", labelEn: "Consumer Staples", labelEs: "Consumo Básico" },
  { slug: "consumer-discretionary", labelEn: "Consumer Discretionary", labelEs: "Consumo Discrecional" },
  { slug: "energy", labelEn: "Energy", labelEs: "Energía" },
  { slug: "communication-services", labelEn: "Communication Services", labelEs: "Servicios de Comunicación" },
  { slug: "materials", labelEn: "Materials", labelEs: "Materiales" },
  { slug: "real-estate", labelEn: "Real Estate", labelEs: "Bienes Raíces" },
  { slug: "utilities", labelEn: "Utilities", labelEs: "Servicios Públicos" },
];

export default async function IndustryPage({
  params,
}: {
  params: { industry: string; locale: string };
}) {
  const { industry: slug, locale } = params;
  const isEs = locale === "es";
  setRequestLocale(locale);
  const allIndustries = await getAllIndustries();
  const label = resolveIndustryLabel(slug, allIndustries);
  if (!label) notFound();
  const stocks = await getIndustryStocks(label);
  const sector = stocks[0]?.sector ?? null;

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "ItemList",
        name: isEs ? `Acciones de la industria ${label}` : `${label} Stocks`,
        numberOfItems: stocks.length,
        itemListElement: stocks.slice(0, 100).map((s, i) => ({
          "@type": "ListItem",
          position: i + 1,
          name: s.company_name ?? s.ticker,
          url: `${BASE_URL}/en/stocks/${s.ticker}`,
        })),
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: isEs ? "Acciones" : "Stocks", item: "https://hedgefun.fun/stocks" },
          { "@type": "ListItem", position: 2, name: isEs ? "Industrias" : "Industries", item: `${BASE_URL}/${locale}/stocks/industry` },
          { "@type": "ListItem", position: 3, name: label, item: `${BASE_URL}/${locale}/stocks/industry/${slug}` },
        ],
      },
    ],
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <div className="bg-gray-50 min-h-screen">
        <header className="bg-white border-b border-gray-200">
          <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-md bg-blue-700 flex items-center justify-center text-white text-xs font-semibold">HF</div>
              <a href="https://hedgefun.fun" className="text-blue-700 font-semibold text-base">HedgeFun</a>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <a href={`/en/stocks/industry/${slug}`} className={!isEs ? "text-blue-700 font-semibold" : "text-gray-400 hover:text-gray-600"}>EN</a>
              <span className="text-gray-300">|</span>
              <a href={`/es/stocks/industry/${slug}`} className={isEs ? "text-blue-700 font-semibold" : "text-gray-400 hover:text-gray-600"}>ES</a>
            </div>
          </div>
        </header>

        <main className="max-w-5xl mx-auto px-4 py-6">
          <nav className="text-sm text-gray-500 mb-4" aria-label="Breadcrumb">
            <a href="https://hedgefun.fun/stocks" className="hover:text-blue-700 transition-colors">{isEs ? "Acciones" : "Stocks"}</a>
            <span className="mx-2 text-gray-300">/</span>
            {sector && (
              <>
                <a href={`${BASE_URL}/${locale}/stocks/sector/${slugify(sector)}`} className="hover:text-blue-700 transition-colors">{sector}</a>
                <span className="mx-2 text-gray-300">/</span>
              </>
            )}
            <span className="text-gray-900 font-medium">{label}</span>
          </nav>

          <div className="bg-white border border-gray-100 rounded-xl shadow-sm p-5 mb-4">
            <h1 className="text-2xl font-semibold text-gray-900 mb-1">{isEs ? `Acciones: ${label}` : `${label} Stocks`}</h1>
            {sector && (
              <p className="text-sm text-blue-700 mb-2">
                <a href={`${BASE_URL}/${locale}/stocks/sector/${slugify(sector)}`} className="hover:underline">
                  {isEs ? `Sector: ${sector}` : `${sector} Sector`}
                </a>
              </p>
            )}
            <p className="text-xs text-gray-400 mt-1">{stocks.length} {isEs ? "empresas" : "companies"}</p>
          </div>

          <div className="w-full flex justify-center my-4">
            <ins className="adsbygoogle" style={{ display: "block" }} data-ad-client="ca-pub-4855396891178044" data-ad-slot="1234567890" data-ad-format="auto" data-full-width-responsive="true" />
          </div>

          <div className="bg-white border border-gray-100 rounded-xl shadow-sm overflow-hidden mb-4">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-3 w-12">#</th>
                    <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-3">{isEs ? "Símbolo" : "Ticker"}</th>
                    <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-3">{isEs ? "Empresa" : "Company"}</th>
                    <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-3 hidden sm:table-cell">{isEs ? "Sector" : "Sector"}</th>
                    <th className="text-right text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-3 hidden sm:table-cell">{isEs ? "Cap. Mercado" : "Market Cap"}</th>
                    <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-3 hidden md:table-cell">{isEs ? "Bolsa" : "Exchange"}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {stocks.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-gray-400 text-sm">
                        {isEs ? "No se encontraron acciones para esta industria." : "No stocks found for this industry."}
                      </td>
                    </tr>
                  ) : (
                    stocks.map((s, i) => (
                      <tr key={s.ticker} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3 text-gray-400 text-xs">{i + 1}</td>
                        <td className="px-4 py-3">
                          <a href={`${BASE_URL}/${locale}/stocks/${s.ticker}`} className="text-blue-700 font-semibold hover:underline">{s.ticker}</a>
                        </td>
                        <td className="px-4 py-3 text-gray-900 font-medium">{s.company_name ?? "—"}</td>
                        <td className="px-4 py-3 text-gray-500 hidden sm:table-cell">
                          {s.sector ? (
                            <a href={`${BASE_URL}/${locale}/stocks/sector/${slugify(s.sector)}`} className="hover:text-blue-700 transition-colors">{s.sector}</a>
                          ) : "—"}
                        </td>
                        <td className="px-4 py-3 text-gray-900 text-right hidden sm:table-cell">{formatMarketCap(s.market_cap)}</td>
                        <td className="px-4 py-3 text-gray-500 hidden md:table-cell">{resolveExchange(s.exchange)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="w-full flex justify-center my-4">
            <ins className="adsbygoogle" style={{ display: "block" }} data-ad-client="ca-pub-4855396891178044" data-ad-slot="0987654321" data-ad-format="auto" data-full-width-responsive="true" />
          </div>
        </main>

        <footer className="bg-slate-900 text-white mt-4">
          <div className="max-w-5xl mx-auto px-4 pt-8 pb-6">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-8 mb-8">
              <div>
                <p className="text-xs font-semibold text-white uppercase tracking-wider mb-3">{isEs ? "Secciones" : "Sections"}</p>
                <div className="flex flex-col gap-2">
                  <a href="https://hedgefun.fun/stocks" className="text-sm text-slate-400 hover:text-white transition-colors">{isEs ? "Acciones" : "Stocks"}</a>
                  <a href="https://hedgefun.fun/etfs" className="text-sm text-slate-400 hover:text-white transition-colors">ETFs</a>
                  <a href="https://hedgefun.fun/ipos" className="text-sm text-slate-400 hover:text-white transition-colors">IPOs</a>
                  <a href="https://hedgefun.fun/news" className="text-sm text-slate-400 hover:text-white transition-colors">{isEs ? "Noticias" : "News"}</a>
                </div>
              </div>
              <div>
                <p className="text-xs font-semibold text-white uppercase tracking-wider mb-3">{isEs ? "Sectores" : "Sectors"}</p>
                <div className="flex flex-col gap-2">
                  {SECTOR_SLUGS.map((s) => (
                    <a key={s.slug} href={`${BASE_URL}/${locale}/stocks/sector/${s.slug}`} className="text-sm text-slate-400 hover:text-white transition-colors">
                      {isEs ? s.labelEs : s.labelEn}
                    </a>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-xs font-semibold text-white uppercase tracking-wider mb-3">{isEs ? "Listas" : "Stock Lists"}</p>
                <div className="flex flex-col gap-2">
                  <a href={`${BASE_URL}/en/stocks/lists/sp500`} className="text-sm text-slate-400 hover:text-white transition-colors">S&amp;P 500</a>
                  <a href={`${BASE_URL}/en/stocks/lists/nasdaq100`} className="text-sm text-slate-400 hover:text-white transition-colors">Nasdaq 100</a>
                  <a href={`${BASE_URL}/en/stocks/lists/dowjones`} className="text-sm text-slate-400 hover:text-white transition-colors">Dow Jones</a>
                  <a href={`${BASE_URL}/en/stocks/lists/faang`} className="text-sm text-slate-400 hover:text-white transition-colors">FAANG</a>
                </div>
              </div>
            </div>
            <div className="border-t border-slate-800 pt-5 flex items-center justify-between flex-wrap gap-2">
              <p className="text-xs text-slate-500">
                © {new Date().getFullYear()} HedgeFun.fun · {isEs ? "Solo para fines informativos. No constituye asesoramiento financiero." : "For informational purposes only. Not financial advice."}
              </p>
              <p className="text-xs text-slate-500">seo.hedgefun.fun</p>
            </div>
          </div>
        </footer>
      </div>
    </>
  );
}
