import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { createServerClient } from "@/lib/supabase";

const BASE_URL = "https://seo.hedgefun.fun";
const MAIN_URL = "https://hedgefun.fun";

export const revalidate = 3600;
export const dynamicParams = true;

interface NewsRow {
  slug: string;
  ticker: string | null;
  title_en: string | null;
  title_es: string | null;
  summary_en: string | null;
  summary_es: string | null;
  source: string | null;
  source_url: string | null;
  image_url: string | null;
  published_at: string | null;
}

export async function generateStaticParams() {
  const supabase = createServerClient();
  const { data } = await supabase
    .from("seo_news")
    .select("slug")
    .order("published_at", { ascending: false })
    .limit(1000);

  const slugs = data ?? [];
  const locales = ["en", "es"];

  return locales.flatMap((locale) =>
    slugs.map((row) => ({ locale, slug: row.slug }))
  );
}

async function getArticle(slug: string): Promise<NewsRow | null> {
  const supabase = createServerClient();
  const { data } = await supabase
    .from("seo_news")
    .select(
      "slug, ticker, title_en, title_es, summary_en, summary_es, source, source_url, image_url, published_at"
    )
    .eq("slug", slug)
    .maybeSingle();
  return data as NewsRow | null;
}

export async function generateMetadata({
  params,
}: {
  params: { slug: string; locale: string };
}): Promise<Metadata> {
  const { slug, locale } = params;
  const isEs = locale === "es";
  const data = await getArticle(slug);

  const title = isEs
    ? (data?.title_es ?? data?.title_en ?? "Noticias financieras | HedgeFun")
    : (data?.title_en ?? "Financial News | HedgeFun");

  const description = isEs
    ? (data?.summary_es ?? data?.summary_en ?? "Lee las últimas noticias financieras en HedgeFun.")
    : (data?.summary_en ?? "Read the latest financial news on HedgeFun.");

  const canonical = `${BASE_URL}/en/news/${slug}`;
  const esCanonical = `${BASE_URL}/es/news/${slug}`;

  return {
    title: `${title} | HedgeFun`,
    description,
    robots: { index: true, follow: true },
    openGraph: {
      title,
      description,
      url: isEs ? esCanonical : canonical,
      type: "article",
      siteName: "HedgeFun",
      images: [
        {
          url: data?.image_url ?? `${BASE_URL}/og-image.png`,
          width: 1200,
          height: 630,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [data?.image_url ?? `${BASE_URL}/og-image.png`],
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

function formatDate(iso: string, locale: string): string {
  return new Date(iso).toLocaleDateString(locale === "es" ? "es-MX" : "en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export default async function NewsArticlePage({
  params,
}: {
  params: { slug: string; locale: string };
}) {
  setRequestLocale(params.locale);
  const { slug, locale } = params;
  const isEs = locale === "es";

  const data = await getArticle(slug);
  if (!data) notFound();

  const title = isEs ? (data.title_es ?? data.title_en) : data.title_en;
  const summary = isEs ? (data.summary_es ?? data.summary_en) : data.summary_en;
  const pubDate = data.published_at ? formatDate(data.published_at, locale) : null;

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "NewsArticle",
        headline: title,
        datePublished: data.published_at,
        url: data.source_url,
        publisher: {
          "@type": "Organization",
          name: data.source ?? "HedgeFun",
        },
        mainEntityOfPage: {
          "@type": "WebPage",
          "@id": `${BASE_URL}/${locale}/news/${slug}`,
        },
        ...(data.image_url ? { image: data.image_url } : {}),
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          {
            "@type": "ListItem",
            position: 1,
            name: "HedgeFun",
            item: BASE_URL,
          },
          {
            "@type": "ListItem",
            position: 2,
            name: isEs ? "Noticias" : "News",
            item: `${MAIN_URL}/news`,
          },
          {
            "@type": "ListItem",
            position: 3,
            name: title ?? slug,
            item: `${BASE_URL}/${locale}/news/${slug}`,
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

      <div className="bg-gray-50 min-h-screen">

        <header className="bg-white border-b border-gray-200">
          <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-md bg-blue-700 flex items-center justify-center text-white text-xs font-semibold">
                HF
              </div>
              <a href={MAIN_URL} className="text-blue-700 font-semibold text-base">
                HedgeFun
              </a>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <a
                href={`/en/news/${slug}`}
                className={!isEs ? "text-blue-700 font-semibold" : "text-gray-400 hover:text-gray-600"}
              >
                EN
              </a>
              <span className="text-gray-300">|</span>
              <a
                href={`/es/news/${slug}`}
                className={isEs ? "text-blue-700 font-semibold" : "text-gray-400 hover:text-gray-600"}
              >
                ES
              </a>
            </div>
          </div>
        </header>

        <main className="max-w-5xl mx-auto px-4 py-6">

          <nav className="text-sm text-gray-500 mb-4" aria-label="Breadcrumb">
            <a href={`${MAIN_URL}/news`} className="hover:text-blue-700 transition-colors">
              {isEs ? "Noticias" : "News"}
            </a>
            <span className="mx-2 text-gray-300">/</span>
            <span className="text-gray-900 font-medium line-clamp-1">
              {title ?? slug}
            </span>
          </nav>

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

          <article className="bg-white border border-gray-100 rounded-xl shadow-sm p-5 mb-4">

            <div className="flex items-center gap-3 mb-3 flex-wrap">
              {data.source && (
                <span className="text-xs font-semibold text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                  {data.source}
                </span>
              )}
              {data.ticker && (
                <a
                  href={`${BASE_URL}/${locale}/stocks/${data.ticker}`}
                  className="text-xs font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded hover:bg-blue-100 transition-colors"
                >
                  {data.ticker}
                </a>
              )}
              {pubDate && (
                <span className="text-xs text-gray-400">{pubDate}</span>
              )}
            </div>

            <h1 className="text-xl sm:text-2xl font-semibold text-gray-900 leading-snug mb-4">
              {title}
            </h1>

            {summary && (
              <p className="text-base text-gray-600 leading-relaxed mb-5">
                {summary}
              </p>
            )}

            {data.source_url && (
              <a
                href={data.source_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 bg-blue-700 hover:bg-blue-800 text-white font-semibold px-6 py-2.5 rounded-lg transition-colors text-sm"
              >
                {isEs ? "Leer artículo completo →" : "Read full article →"}
              </a>
            )}
          </article>

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

          {data.ticker && (
            <div className="bg-white border border-gray-100 rounded-xl shadow-sm p-5 mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <p className="text-xs text-gray-500 mb-0.5">
                  {isEs ? "Análisis relacionado" : "Related analysis"}
                </p>
                <p className="text-base font-semibold text-gray-900">
                  {isEs
                    ? `Ver datos completos de ${data.ticker} en HedgeFun`
                    : `View full ${data.ticker} data on HedgeFun`}
                </p>
              </div>
              <a
                href={`${MAIN_URL}/stocks/${data.ticker}`}
                className="inline-flex items-center justify-center gap-2 bg-blue-700 hover:bg-blue-800 text-white font-semibold px-6 py-2.5 rounded-lg transition-colors text-sm whitespace-nowrap"
              >
                {isEs ? `Analizar ${data.ticker} →` : `Analyze ${data.ticker} →`}
              </a>
            </div>
          )}

        </main>

        <footer className="bg-slate-900 text-white mt-4">
          <div className="max-w-5xl mx-auto px-4 pt-8 pb-6">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-8 mb-8">
              <div>
                <p className="text-xs font-semibold text-white uppercase tracking-wider mb-3">
                  {isEs ? "Secciones" : "Sections"}
                </p>
                <div className="flex flex-col gap-2">
                  <a href={`${MAIN_URL}/stocks`} className="text-sm text-slate-400 hover:text-white transition-colors">
                    {isEs ? "Acciones" : "Stocks"}
                  </a>
                  <a href={`${MAIN_URL}/etfs`} className="text-sm text-slate-400 hover:text-white transition-colors">
                    ETFs
                  </a>
                  <a href={`${MAIN_URL}/ipos`} className="text-sm text-slate-400 hover:text-white transition-colors">
                    IPOs
                  </a>
                  <a href={`${MAIN_URL}/news`} className="text-sm text-slate-400 hover:text-white transition-colors">
                    {isEs ? "Noticias" : "News"}
                  </a>
                </div>
              </div>
              <div>
                <p className="text-xs font-semibold text-white uppercase tracking-wider mb-3">
                  {isEs ? "Listas" : "Stock lists"}
                </p>
                <div className="flex flex-col gap-2">
                  <a href={`${BASE_URL}/en/stocks/lists/sp500`} className="text-sm text-slate-400 hover:text-white transition-colors">S&amp;P 500</a>
                  <a href={`${BASE_URL}/en/stocks/lists/nasdaq100`} className="text-sm text-slate-400 hover:text-white transition-colors">Nasdaq 100</a>
                  <a href={`${BASE_URL}/en/stocks/lists/dowjones`} className="text-sm text-slate-400 hover:text-white transition-colors">Dow Jones</a>
                  <a href={`${BASE_URL}/en/stocks/lists/faang`} className="text-sm text-slate-400 hover:text-white transition-colors">FAANG</a>
                </div>
              </div>
              <div>
                <p className="text-xs font-semibold text-white uppercase tracking-wider mb-3">
                  {isEs ? "Empresa" : "Company"}
                </p>
                <div className="flex flex-col gap-2">
                  <a href={`${MAIN_URL}/about`} className="text-sm text-slate-400 hover:text-white transition-colors">
                    {isEs ? "Acerca de" : "About"}
                  </a>
                  <a href={`${MAIN_URL}/privacy`} className="text-sm text-slate-400 hover:text-white transition-colors">
                    {isEs ? "Privacidad" : "Privacy policy"}
                  </a>
                  <a href={`${MAIN_URL}/terms`} className="text-sm text-slate-400 hover:text-white transition-colors">
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
