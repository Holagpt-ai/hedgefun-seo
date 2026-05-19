import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { createServerClient } from "@/lib/supabase";

const BASE_URL = "https://seo.hedgefun.fun";

export const revalidate = 86400;
export const dynamicParams = false;

const SECTOR_CONFIG: Record<
  string,
  {
    label: string;
    labelEs: string;
    descEn: string;
    descEs: string;
  }
> = {
  technology: {
    label: "Technology",
    labelEs: "Tecnología",
    descEn: "Companies developing software, hardware, semiconductors, and IT services.",
    descEs: "Empresas que desarrollan software, hardware, semiconductores y servicios de TI.",
  },
  financials: {
    label: "Financials",
    labelEs: "Finanzas",
    descEn: "Banks, insurance companies, asset managers, and payment processors.",
    descEs: "Bancos, aseguradoras, gestores de activos y procesadores de pagos.",
  },
  healthcare: {
    label: "Healthcare",
    labelEs: "Salud",
    descEn: "Pharmaceutical, biotech, medical device, and healthcare services companies.",
    descEs: "Empresas farmacéuticas, biotecnológicas, de dispositivos médicos y servicios de salud.",
  },
  industrials: {
    label: "Industrials",
    labelEs: "Industriales",
    descEn: "Aerospace, defense, machinery, transportation, and construction companies.",
    descEs: "Empresas de aeroespacial, defensa, maquinaria, transporte y construcción.",
  },
  "consumer-staples": {
    label: "Consumer Staples",
    labelEs: "Consumo Básico",
    descEn: "Producers of essential goods including food, beverages, tobacco, and household products.",
    descEs: "Productores de bienes esenciales como alimentos, bebidas, tabaco y productos del hogar.",
  },
  "consumer-discretionary": {
    label: "Consumer Discretionary",
    labelEs: "Consumo Discrecional",
    descEn: "Retailers, automakers, hotels, restaurants, and other non-essential consumer goods companies.",
    descEs: "Minoristas, fabricantes de automóviles, hoteles, restaurantes y otras empresas de bienes de consumo no esenciales.",
  },
  energy: {
    label: "Energy",
    labelEs: "Energía",
    descEn: "Oil, gas, coal, and renewable energy exploration, production, and services companies.",
    descEs: "Empresas de exploración, producción y servicios de petróleo, gas, carbón y energías renovables.",
  },
  "communication-services": {
    label: "Communication Services",
    labelEs: "Servicios de Comunicación",
    descEn: "Telecom carriers, media companies, interactive entertainment, and social media platforms.",
    descEs: "Operadores de telecomunicaciones, medios de comunicación, entretenimiento interactivo y plataformas de redes sociales.",
  },
  materials: {
    label: "Materials",
    labelEs: "Materiales",
    descEn: "Mining, chemicals, construction materials, packaging, and paper companies.",
    descEs: "Empresas de minería, química, materiales de construcción, envases y papel.",
  },
  "real-estate": {
    label: "Real Estate",
    labelEs: "Bienes Raíces",
    descEn: "Real estate investment trusts (REITs) and property management companies.",
    descEs: "Fondos de inversión inmobiliaria (REITs) y empresas de gestión de propiedades.",
  },
  utilities: {
    label: "Utilities",
    labelEs: "Servicios Públicos",
    descEn: "Electric, gas, and water utility companies providing essential public services.",
    descEs: "Empresas de servicios públicos de electricidad, gas y agua que prestan servicios esenciales.",
  },
};

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

export async function generateStaticParams() {
  const slugs = Object.keys(SECTOR_CONFIG);
  const locales = ["en", "es"];
  return slugs.flatMap((sector) =>
    locales.map((locale) => ({ sector, locale }))
  );
}

async function getSectorStocks(sectorLabel: string) {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("seo_tickers")
    .select("ticker, company_name, sector, industry, market_cap, exchange")
    .eq("type", "stock")
    .eq("sector", sectorLabel)
    .order("market_cap", { ascending: false })
    .limit(500);

  if (error) return [];
  return data ?? [];
}

export async function generateMetadata({
  params,
}: {
  params: { sector: string; locale: string };
}): Promise<Metadata> {
  const { sector, locale } = params;
  const isEs = locale === "es";
  const config = SECTOR_CONFIG[sector];
  if (!config) return {};

  const title = isEs
    ? `Acciones de ${config.labelEs} — Lista Completa y Análisis | HedgeFun`
    : `${config.label} Stocks — Full List & Analysis | HedgeFun`;
  const description = isEs
    ? `Explora todas las acciones del sector ${config.labelEs} listadas en bolsas de EE.UU. Ordenadas por capitalización de mercado con datos de industria. HedgeFun.`
    : `Browse all ${config.label} stocks listed on US exchanges. Sorted by market cap with industry data. Powered by HedgeFun.`;

  const canonical = `${BASE_URL}/en/stocks/sector/${sector}`;
  const esCanonical = `${BASE_URL}/es/stocks/sector/${sector}`;

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

export default async function SectorPage({
  params,
}: {
  params: { sector: string; locale: string };
}) {
  const { sector, locale } = params;
  const isEs = locale === "es";
  setRequestLocale(locale);

  const config = SECTOR_CONFIG[sector];
  if (!config) notFound();

  const stocks = await getSectorStocks(config.label);
  const label = isEs ? config.labelEs : config.label;
  const desc = isEs ? config.descEs : config.descEn;

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "ItemList",
        name: isEs ? `Acciones del sector ${config.labelEs}` : `${config.label} Stocks`,
        description: desc,
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
          { "@type": "ListItem", position: 2, name: isEs ? "Sectores" : "Sectors", item: `${BASE_URL}/${locale}/stocks/sector` },
          { "@type": "ListItem", position: 3, name: label, item: `${BASE_URL}/${locale}/stocks/sector/${sector}` },
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
              <a href={`/en/stocks/sector/${sector}`} className={!isEs ? "text-blue-700 font-semibold" : "text-gray-400 hover:text-gray-600"}>EN</a>
              <span className="text-gray-300">|</span>
              <a href={`/es/stocks/sector/${sector}`} className={isEs ? "text-blue-700 font-semibold" : "text-gray-400 hover:text-gray-600"}>ES</a>
            </div>
          </div>
        </header>

        <main className="max-w-5xl mx-auto px-4 py-6">
          <nav className="text-sm text-gray-500 mb-4" aria-label="Breadcrumb">
            <a href="https://hedgefun.fun/stocks" className="hover:text-blue-700 transition-colors">{isEs ? "Acciones" : "Stocks"}</a>
            <span className="mx-2 text-gray-300">/</span>
            <span className="text-gray-900 font-medium">{label}</span>
          </nav>

          <div className="bg-white border border-gray-100 rounded-xl shadow-sm p-5 mb-4">
            <h1 className="text-2xl font-semibold text-gray-900 mb-2">
              {isEs ? `Acciones del Sector ${config.labelEs}` : `${config.label} Stocks`}
            </h1>
            <p className="text-sm text-gray-500 leading-relaxed">{desc}</p>
            <p className="text-xs text-gray-400 mt-2">{stocks.length} {isEs ? "empresas" : "companies"}</p>
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
                    <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-3 hidden sm:table-cell">{isEs ? "Industria" : "Industry"}</th>
                    <th className="text-right text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-3 hidden sm:table-cell">{isEs ? "Cap. Mercado" : "Market Cap"}</th>
                    <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-3 hidden md:table-cell">{isEs ? "Bolsa" : "Exchange"}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {stocks.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-gray-400 text-sm">
                        {isEs ? "No se encontraron acciones para este sector." : "No stocks found for this sector."}
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
                        <td className="px-4 py-3 text-gray-500 hidden sm:table-cell">{s.industry ?? "—"}</td>
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
                  {Object.entries(SECTOR_CONFIG).map(([slug, cfg]) => (
                    <a key={slug} href={`${BASE_URL}/${locale}/stocks/sector/${slug}`} className="text-sm text-slate-400 hover:text-white transition-colors">
                      {isEs ? cfg.labelEs : cfg.label}
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
