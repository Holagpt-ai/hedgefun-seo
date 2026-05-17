import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { createServerClient } from "@/lib/supabase";

const BASE_URL = "https://seo.hedgefun.fun";

export const revalidate = 86400;
export const dynamicParams = false;

const LIST_CONFIG: Record<
  string,
  {
    titleEn: string;
    titleEs: string;
    descEn: string;
    descEs: string;
    tickers: string[];
  }
> = {
  faang: {
    titleEn: "FAANG Stocks",
    titleEs: "Acciones FAANG",
    descEn:
      "FAANG refers to the five most influential technology companies in the US market: Meta, Apple, Amazon, Netflix, and Alphabet (Google).",
    descEs:
      "FAANG se refiere a las cinco empresas tecnológicas más influyentes del mercado estadounidense: Meta, Apple, Amazon, Netflix y Alphabet (Google).",
    tickers: ["META", "AAPL", "AMZN", "NFLX", "GOOGL"],
  },
  dowjones: {
    titleEn: "Dow Jones Industrial Average",
    titleEs: "Promedio Industrial Dow Jones",
    descEn:
      "The Dow Jones Industrial Average tracks 30 large, publicly-owned companies trading on the NYSE and NASDAQ.",
    descEs:
      "El Promedio Industrial Dow Jones sigue a 30 grandes empresas que cotizan en NYSE y NASDAQ.",
    tickers: [
      "AAPL",
      "AMGN",
      "AXP",
      "BA",
      "CAT",
      "CRM",
      "CSCO",
      "CVX",
      "DIS",
      "DOW",
      "GS",
      "HD",
      "HON",
      "IBM",
      "JNJ",
      "JPM",
      "KO",
      "MCD",
      "MMM",
      "MRK",
      "MSFT",
      "NKE",
      "PG",
      "SHW",
      "TRV",
      "UNH",
      "V",
      "VZ",
      "WMT",
      "WBA",
    ],
  },
  nasdaq100: {
    titleEn: "Nasdaq 100 Companies",
    titleEs: "Empresas del Nasdaq 100",
    descEn:
      "The Nasdaq 100 includes the 100 largest non-financial companies listed on the Nasdaq Stock Market.",
    descEs:
      "El Nasdaq 100 incluye las 100 empresas no financieras más grandes listadas en el mercado Nasdaq.",
    tickers: [
      "AAPL",
      "ABNB",
      "ADBE",
      "ADI",
      "ADP",
      "ADSK",
      "AEP",
      "AMAT",
      "AMD",
      "AMGN",
      "AMZN",
      "ANSS",
      "APP",
      "ARM",
      "ASML",
      "AVGO",
      "AXON",
      "AZN",
      "BIIB",
      "BKNG",
      "BKR",
      "CCEP",
      "CDNS",
      "CDW",
      "CEG",
      "CHTR",
      "CMCSA",
      "COST",
      "CPRT",
      "CRWD",
      "CSCO",
      "CSGP",
      "CSX",
      "CTAS",
      "CTSH",
      "DASH",
      "DDOG",
      "DLTR",
      "DXCM",
      "EA",
      "EXC",
      "FANG",
      "FAST",
      "FTNT",
      "GEHC",
      "GFS",
      "GILD",
      "GOOG",
      "GOOGL",
      "HON",
      "IDXX",
      "ILMN",
      "INTC",
      "INTU",
      "ISRG",
      "KDP",
      "KHC",
      "KLAC",
      "LIN",
      "LRCX",
      "LULU",
      "MAR",
      "MCHP",
      "MDB",
      "MDLZ",
      "META",
      "MELI",
      "MNST",
      "MRNA",
      "MRVL",
      "MSFT",
      "MU",
      "NFLX",
      "NVDA",
      "NXPI",
      "ODFL",
      "ON",
      "ORLY",
      "PANW",
      "PAYX",
      "PCAR",
      "PDD",
      "PEP",
      "PYPL",
      "QCOM",
      "REGN",
      "ROP",
      "ROST",
      "SBUX",
      "SIRI",
      "SNPS",
      "SPLK",
      "TEAM",
      "TMUS",
      "TSLA",
      "TTD",
      "TTWO",
      "TXN",
      "VRSK",
      "VRTX",
      "WBA",
      "WBD",
      "WDAY",
      "XEL",
      "ZS",
    ],
  },
  sp500: {
    titleEn: "S&P 500 Companies",
    titleEs: "Empresas del S&P 500",
    descEn:
      "The S&P 500 tracks 500 of the largest publicly traded companies in the United States, representing approximately 80% of total US market capitalization.",
    descEs:
      "El S&P 500 sigue a 500 de las empresas más grandes que cotizan en bolsa en Estados Unidos, representando aproximadamente el 80% de la capitalización total del mercado estadounidense.",
    tickers: [
      "MMM",
      "AOS",
      "ABT",
      "ABBV",
      "ACN",
      "ADBE",
      "AMD",
      "AES",
      "AFL",
      "A",
      "APD",
      "ABNB",
      "AKAM",
      "ALB",
      "ARE",
      "ALGN",
      "ALLE",
      "LNT",
      "ALL",
      "GOOGL",
      "GOOG",
      "MO",
      "AMZN",
      "AMCR",
      "AEE",
      "AAL",
      "AEP",
      "AXP",
      "AIG",
      "AMT",
      "AWK",
      "AMP",
      "AME",
      "AMGN",
      "APH",
      "ADI",
      "ANSS",
      "AON",
      "APA",
      "AAPL",
      "AMAT",
      "APTV",
      "ACGL",
      "ADM",
      "ANET",
      "AJG",
      "AIZ",
      "T",
      "ATO",
      "ADSK",
      "AZO",
      "AVB",
      "AVY",
      "AXON",
      "BKR",
      "BALL",
      "BAC",
      "BAX",
      "BDX",
      "WRB",
      "BBY",
      "BIO",
      "TECH",
      "BIIB",
      "BLK",
      "BX",
      "BA",
      "BCR",
      "BMY",
      "AVGO",
      "BR",
      "BRO",
      "BF.B",
      "BLDR",
      "BXP",
      "CHRW",
      "CDNS",
      "CZR",
      "CPT",
      "CPB",
      "COF",
      "CAH",
      "KMX",
      "CCL",
      "CARR",
      "CTLT",
      "CAT",
      "CBOE",
      "CBRE",
      "CDW",
      "CE",
      "COR",
      "CNC",
      "CNX",
      "CDAY",
      "CF",
      "CRL",
      "SCHW",
      "CHTR",
      "CVX",
      "CMG",
      "CB",
      "CHD",
      "CI",
      "CINF",
      "CTAS",
      "CSCO",
      "C",
      "CFG",
      "CLX",
      "CME",
      "CMS",
      "KO",
      "CTSH",
      "CL",
      "CMCSA",
      "CMA",
      "CAG",
      "COP",
      "ED",
      "STZ",
      "CEG",
      "COO",
      "CPRT",
      "GLW",
      "CPAY",
      "CTVA",
      "CSGP",
      "COST",
      "CTRA",
      "CRWD",
      "CCI",
      "CSX",
      "CMI",
      "CVS",
      "DHR",
      "DHI",
      "DXCM",
      "DE",
      "DAL",
      "DVN",
      "DDOG",
      "DFS",
      "DG",
      "DLTR",
      "D",
      "DPZ",
      "DOV",
      "DOW",
      "DHR",
      "DTE",
      "DUK",
      "DD",
      "EMN",
      "ETN",
      "EBAY",
      "ECL",
      "EIX",
      "EW",
      "EA",
      "ELV",
      "EMR",
      "ENPH",
      "ETR",
      "EOG",
      "EPAM",
      "EQT",
      "EFX",
      "EQIX",
      "EQR",
      "ESS",
      "EL",
      "ETSY",
      "EG",
      "EVRG",
      "ES",
      "EXC",
      "EXPE",
      "EXPD",
      "EXR",
      "XOM",
      "FFIV",
      "FDS",
      "FICO",
      "FAST",
      "FRT",
      "FDX",
      "FIS",
      "FITB",
      "FSLR",
      "FE",
      "FI",
      "FLT",
      "FMC",
      "F",
      "FTNT",
      "FTV",
      "FOXA",
      "FOX",
      "BEN",
      "FCX",
      "GRMN",
      "IT",
      "GE",
      "GEHC",
      "GEV",
      "GEN",
      "GNRC",
      "GD",
      "GIS",
      "GPC",
      "GILD",
      "GXO",
      "GL",
      "GDDY",
      "GS",
      "HAL",
      "HIG",
      "HAS",
      "HCA",
      "DOC",
      "HSIC",
      "HSY",
      "HES",
      "HPE",
      "HLT",
      "HOLX",
      "HD",
      "HON",
      "HRL",
      "HST",
      "HWM",
      "HPQ",
      "HUBB",
      "HUM",
      "HBAN",
      "HII",
      "IBM",
      "IEX",
      "IDXX",
      "ITW",
      "INCY",
      "IR",
      "PODD",
      "INTC",
      "ICE",
      "IFF",
      "IP",
      "IPG",
      "INTU",
      "ISRG",
      "IVZ",
      "INVH",
      "IQV",
      "IRM",
      "JBAL",
      "JKHY",
      "J",
      "JBL",
      "JNPR",
      "JCI",
      "JPM",
      "JNPR",
      "K",
      "KVUE",
      "KDP",
      "KEY",
      "KEYS",
      "KMB",
      "KIM",
      "KMI",
      "KLAC",
      "KHC",
      "KR",
      "LHX",
      "LH",
      "LRCX",
      "LW",
      "LVS",
      "LDOS",
      "LEN",
      "LLY",
      "LIN",
      "LYV",
      "LKQ",
      "LMT",
      "L",
      "LOW",
      "LULU",
      "LYB",
      "MTB",
      "MRO",
      "MPC",
      "MKTX",
      "MAR",
      "MMC",
      "MLM",
      "MAS",
      "MA",
      "MTCH",
      "MKC",
      "MCD",
      "MCK",
      "MDT",
      "MRK",
      "META",
      "MET",
      "MTD",
      "MGM",
      "MCHP",
      "MU",
      "MSFT",
      "MAA",
      "MRNA",
      "MHK",
      "MOH",
      "TAP",
      "MDLZ",
      "MPWR",
      "MNST",
      "MCO",
      "MS",
      "MOS",
      "MSI",
      "MSCI",
      "NDAQ",
      "NTAP",
      "NFLX",
      "NWL",
      "NEM",
      "NWSA",
      "NWS",
      "NEE",
      "NKE",
      "NI",
      "NDSN",
      "NSC",
      "NTRS",
      "NOC",
      "NCLH",
      "NRG",
      "NUE",
      "NVDA",
      "NVR",
      "NXPI",
      "ORLY",
      "OXY",
      "ODFL",
      "OMC",
      "ON",
      "OKE",
      "ORCL",
      "OTIS",
      "PCAR",
      "PKG",
      "PANW",
      "PH",
      "PAYX",
      "PAYC",
      "PYPL",
      "PNR",
      "PEP",
      "PFE",
      "PCG",
      "PM",
      "PSX",
      "PNW",
      "PNC",
      "POOL",
      "PPG",
      "PPL",
      "PFG",
      "PG",
      "PGR",
      "PLD",
      "PRU",
      "PEG",
      "PTC",
      "PSA",
      "PHM",
      "QRVO",
      "PWR",
      "QCOM",
      "DGX",
      "RL",
      "RJF",
      "RTX",
      "O",
      "REG",
      "REGN",
      "RF",
      "RSG",
      "RMD",
      "RVTY",
      "ROK",
      "ROL",
      "ROP",
      "ROST",
      "RCL",
      "SPGI",
      "CRM",
      "SBAC",
      "SLB",
      "STX",
      "SRE",
      "NOW",
      "SHW",
      "SPG",
      "SWKS",
      "SJM",
      "SNA",
      "SOLV",
      "SO",
      "LUV",
      "SWK",
      "SBUX",
      "STT",
      "STLD",
      "STE",
      "SYK",
      "SYF",
      "SNPS",
      "SYY",
      "TMUS",
      "TROW",
      "TTWO",
      "TPR",
      "TRGP",
      "TGT",
      "TEL",
      "TDY",
      "TFX",
      "TER",
      "TSLA",
      "TXN",
      "TXT",
      "TMO",
      "TJX",
      "TSCO",
      "TT",
      "TDG",
      "TRV",
      "TRMB",
      "TFC",
      "TYL",
      "TSN",
      "USB",
      "UBER",
      "UDR",
      "UHS",
      "UNP",
      "UAL",
      "UPS",
      "URI",
      "UNH",
      "UHS",
      "VLO",
      "VTR",
      "VLTO",
      "V",
      "VNT",
      "VRSN",
      "VRSK",
      "VZ",
      "VRTX",
      "VTRS",
      "VICI",
      "VMC",
      "WRK",
      "WAB",
      "WMT",
      "WBD",
      "WDAY",
      "WEC",
      "WFC",
      "WELL",
      "WST",
      "WDC",
      "WRK",
      "WHR",
      "WMB",
      "WTW",
      "GWW",
      "WYNN",
      "XEL",
      "XYL",
      "YUM",
      "ZBRA",
      "ZBH",
      "ZTS",
    ],
  },
};

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

function toTitleCase(str: string): string {
  return str
    .toLowerCase()
    .replace(/[-,]+/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ")
    .replace(/\bAnd\b/g, "and")
    .replace(/\bOf\b/g, "of")
    .replace(/\bThe\b/g, "the")
    .replace(/\bNo\b/g, "no")
    .replace(/\bNec\b/g, "nec")
    .replace(/&/g, "&");
}

export async function generateStaticParams() {
  const slugs = ["sp500", "nasdaq100", "dowjones", "faang"];
  const locales = ["en", "es"];
  return slugs.flatMap((list) => locales.map((locale) => ({ list, locale })));
}

export async function generateMetadata({
  params,
}: {
  params: { list: string; locale: string };
}): Promise<Metadata> {
  const { list, locale } = params;
  const isEs = locale === "es";
  const config = LIST_CONFIG[list];
  if (!config) return {};

  const title = isEs ? `${config.titleEs} | HedgeFun` : `${config.titleEn} | HedgeFun`;
  const description = isEs ? config.descEs : config.descEn;
  const canonical = `${BASE_URL}/en/stocks/lists/${list}`;
  const esCanonical = `${BASE_URL}/es/stocks/lists/${list}`;

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

export default async function StockListPage({
  params,
}: {
  params: { list: string; locale: string };
}) {
  const { list, locale } = params;
  const isEs = locale === "es";
  setRequestLocale(locale);

  const config = LIST_CONFIG[list];
  if (!config) notFound();

  const supabase = createServerClient();
  const { data: rows } = await supabase
    .from("seo_tickers")
    .select("ticker, company_name, sector, market_cap, exchange")
    .in("ticker", config.tickers);

  const rowMap = new Map((rows ?? []).map((r) => [r.ticker, r]));

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: isEs ? config.titleEs : config.titleEn,
    description: isEs ? config.descEs : config.descEn,
    numberOfItems: config.tickers.length,
    itemListElement: config.tickers.map((ticker, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: rowMap.get(ticker)?.company_name ?? ticker,
      url: `${BASE_URL}/en/stocks/${ticker}`,
    })),
  };

  const pageTitle = isEs ? config.titleEs : config.titleEn;
  const pageDesc = isEs ? config.descEs : config.descEn;

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <div className="bg-gray-50 min-h-screen">
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
                href={`/en/stocks/lists/${list}`}
                className={!isEs ? "text-blue-700 font-semibold" : "text-gray-400 hover:text-gray-600"}
              >
                EN
              </a>
              <span className="text-gray-300">|</span>
              <a
                href={`/es/stocks/lists/${list}`}
                className={isEs ? "text-blue-700 font-semibold" : "text-gray-400 hover:text-gray-600"}
              >
                ES
              </a>
            </div>
          </div>
        </header>

        <main className="max-w-5xl mx-auto px-4 py-6">
          <nav className="text-sm text-gray-500 mb-4" aria-label="Breadcrumb">
            <a href="https://hedgefun.fun/stocks" className="hover:text-blue-700 transition-colors">
              {isEs ? "Acciones" : "Stocks"}
            </a>
            <span className="mx-2 text-gray-300">/</span>
            <a href={`${BASE_URL}/en/stocks/lists/${list}`} className="hover:text-blue-700 transition-colors">
              {isEs ? "Listas" : "Lists"}
            </a>
            <span className="mx-2 text-gray-300">/</span>
            <span className="text-gray-900 font-medium">{pageTitle}</span>
          </nav>

          <div className="bg-white border border-gray-100 rounded-xl shadow-sm p-5 mb-4">
            <h1 className="text-2xl font-semibold text-gray-900 mb-2">{pageTitle}</h1>
            <p className="text-sm text-gray-500 leading-relaxed">{pageDesc}</p>
            <p className="text-xs text-gray-400 mt-2">
              {config.tickers.length} {isEs ? "empresas" : "companies"}
            </p>
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

          <div className="bg-white border border-gray-100 rounded-xl shadow-sm overflow-hidden mb-4">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-3 w-12">#</th>
                    <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-3">
                      {isEs ? "Símbolo" : "Ticker"}
                    </th>
                    <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-3">
                      {isEs ? "Empresa" : "Company"}
                    </th>
                    <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-3 hidden sm:table-cell">
                      {isEs ? "Sector" : "Sector"}
                    </th>
                    <th className="text-right text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-3 hidden sm:table-cell">
                      {isEs ? "Cap. Mercado" : "Market Cap"}
                    </th>
                    <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-3 hidden md:table-cell">
                      {isEs ? "Bolsa" : "Exchange"}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {config.tickers.map((ticker, i) => {
                    const row = rowMap.get(ticker);
                    return (
                      <tr key={ticker} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3 text-gray-400 text-xs">{i + 1}</td>
                        <td className="px-4 py-3">
                          <a
                            href={`${BASE_URL}/${locale}/stocks/${ticker}`}
                            className="text-blue-700 font-semibold hover:underline"
                          >
                            {ticker}
                          </a>
                        </td>
                        <td className="px-4 py-3 text-gray-900 font-medium">{row?.company_name ?? "—"}</td>
                        <td className="px-4 py-3 text-gray-500 hidden sm:table-cell">
                          {row?.sector ? toTitleCase(row.sector) : "—"}
                        </td>
                        <td className="px-4 py-3 text-gray-900 text-right hidden sm:table-cell">
                          {row?.market_cap ? formatMarketCap(row.market_cap) : "—"}
                        </td>
                        <td className="px-4 py-3 text-gray-500 hidden md:table-cell">
                          {row?.exchange ? resolveExchange(row.exchange) : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

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
                  <a href="https://hedgefun.fun/etfs" className="text-sm text-slate-400 hover:text-white transition-colors">
                    ETFs
                  </a>
                  <a href="https://hedgefun.fun/ipos" className="text-sm text-slate-400 hover:text-white transition-colors">
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
                  <a href={`${BASE_URL}/en/stocks/lists/sp500`} className="text-sm text-slate-400 hover:text-white transition-colors">
                    S&amp;P 500
                  </a>
                  <a
                    href={`${BASE_URL}/en/stocks/lists/nasdaq100`}
                    className="text-sm text-slate-400 hover:text-white transition-colors"
                  >
                    Nasdaq 100
                  </a>
                  <a
                    href={`${BASE_URL}/en/stocks/lists/dowjones`}
                    className="text-sm text-slate-400 hover:text-white transition-colors"
                  >
                    Dow Jones
                  </a>
                  <a href={`${BASE_URL}/en/stocks/lists/faang`} className="text-sm text-slate-400 hover:text-white transition-colors">
                    FAANG
                  </a>
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
      </div>
    </>
  );
}
