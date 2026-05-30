import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { createServerClient } from "@/lib/supabase";
import type { TickerRow } from "@/types";

const BASE_URL = "https://seo.hedgefun.fun";

export const revalidate = 3600;
export const dynamicParams = true;

export async function generateStaticParams() {
  const supabase = createServerClient();
  const { data } = await supabase
    .from("seo_tickers")
    .select("ticker")
    .eq("type", "etf")
    .limit(5000);
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

function formatMarketCap(value: number): string {
  if (value <= 0) return "";
  if (value >= 1e12) return `$${(value / 1e12).toFixed(1)}T`;
  if (value >= 1e9) return `$${(value / 1e9).toFixed(1)}B`;
  if (value >= 1e6) return `$${(value / 1e6).toFixed(1)}M`;
  return value.toLocaleString();
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

  const ed = (data.entity_data as Record<string, unknown>) ?? {};
  const entityWebsite = (ed.website as string | null) ?? null;
  const entityHeadquarters = (ed.headquarters as string | null) ?? null;
  const entityEmployees = (ed.employees as number | null) ?? null;

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

        <section className="mt-8">
            <h2 className="text-sm font-medium text-zinc-500 uppercase tracking-wide mb-3">
              {isEs ? "Datos clave" : "Key Facts"}
            </h2>
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 border border-zinc-200 rounded-lg p-4 sm:p-5">
              {data.exchange && (
                <div>
                  <dt className="text-xs text-zinc-500 mb-0.5">{isEs ? "Bolsa" : "Exchange"}</dt>
                  <dd className="text-sm font-medium text-slate-900">{data.exchange}</dd>
                </div>
              )}
              <div>
                <dt className="text-xs text-zinc-500 mb-0.5">{isEs ? "Tipo" : "Type"}</dt>
                <dd className="text-sm font-medium text-slate-900">ETF</dd>
              </div>
              {data.sector && (
                <div>
                  <dt className="text-xs text-zinc-500 mb-0.5">{isEs ? "Sector" : "Sector"}</dt>
                  <dd className="text-sm font-medium text-slate-900">{data.sector}</dd>
                </div>
              )}
              {data.industry && (
                <div>
                  <dt className="text-xs text-zinc-500 mb-0.5">{isEs ? "Industria" : "Industry"}</dt>
                  <dd className="text-sm font-medium text-slate-900">{data.industry}</dd>
                </div>
              )}
              {data.market_cap != null && data.market_cap > 0 && (
                <div>
                  <dt className="text-xs text-zinc-500 mb-0.5">{isEs ? "Cap. de mercado" : "Market Cap"}</dt>
                  <dd className="text-sm font-medium text-slate-900">{formatMarketCap(data.market_cap)}</dd>
                </div>
              )}
              {entityWebsite && (
                <div>
                  <dt className="text-xs text-zinc-500 mb-0.5">{isEs ? "Sitio web" : "Website"}</dt>
                  <dd className="text-sm font-medium text-slate-900">
                    <a
                      href={entityWebsite.startsWith("http") ? entityWebsite : `https://${entityWebsite}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-emerald-700 hover:text-emerald-800 underline underline-offset-2"
                    >
                      {entityWebsite.replace(/^https?:\/\//, "").replace(/\/$/, "")}
                    </a>
                  </dd>
                </div>
              )}
              {entityHeadquarters && (
                <div>
                  <dt className="text-xs text-zinc-500 mb-0.5">{isEs ? "Sede" : "Headquarters"}</dt>
                  <dd className="text-sm font-medium text-slate-900">{entityHeadquarters}</dd>
                </div>
              )}
              {entityEmployees != null && (
                <div>
                  <dt className="text-xs text-zinc-500 mb-0.5">{isEs ? "Empleados" : "Employees"}</dt>
                  <dd className="text-sm font-medium text-slate-900">{Number(entityEmployees).toLocaleString()}</dd>
                </div>
              )}
            </dl>
        </section>

        <p className="mt-8 text-xs text-gray-400">
          {isEs
            ? "HedgeFun es solo para fines informativos."
            : "HedgeFun is for informational purposes only."}
        </p>
      </main>
    </>
  );
}
