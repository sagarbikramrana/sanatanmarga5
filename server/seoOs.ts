import { collection, getDocs, query, where, orderBy, limit } from "firebase/firestore";

export const CANONICAL_DOMAIN = "https://sanatanmarga.com";

// Phase 2: Explicit Route Indexability Policy
export const INDEXABLE_ROUTE_PATTERNS = [
  /^\/$/,
  /^\/news(\/.*)?$/,
  /^\/latest$/,
  /^\/trending$/,
  /^\/article\/[a-zA-Z0-9_-]+$/,
  /^\/blog(\/.*)?$/,
  /^\/blog\/post\/[a-zA-Z0-9_-]+$/,
  /^\/blog\/category\/[a-zA-Z0-9_-]+$/,
  /^\/blog\/series\/[a-zA-Z0-9_-]+$/,
  /^\/blog\/author\/[a-zA-Z0-9_-]+$/,
  /^\/sgis(\/.*)?$/,
  /^\/sgis\/text\/[a-zA-Z0-9_-]+$/,
  /^\/knowledge(\/.*)?$/,
  /^\/knowledge\/node\/[a-zA-Z0-9_-]+$/,
  /^\/nepal-hub(\/.*)?$/,
  /^\/district\/[a-zA-Z0-9_-]+$/,
  /^\/category\/[a-zA-Z0-9_-]+$/,
  /^\/events(\/.*)?$/,
  /^\/events\/[a-zA-Z0-9_-]+$/,
  /^\/storylines(\/.*)?$/,
  /^\/storyline\/[a-zA-Z0-9_-]+$/,
  /^\/models(\/.*)?$/,
  /^\/models\/[a-zA-Z0-9_-]+$/,
  /^\/about$/,
  /^\/editorial-policy$/,
  /^\/transparency$/,
  /^\/authors$/,
  /^\/contact$/,
  /^\/privacy$/,
  /^\/terms$/
];

export const NOINDEX_ROUTE_PATTERNS = [
  /^\/admin(\/.*)?$/,
  /^\/editor(\/.*)?$/,
  /^\/dashboard(\/.*)?$/,
  /^\/login$/,
  /^\/signup$/,
  /^\/profile(\/.*)?$/,
  /^\/account(\/.*)?$/,
  /^\/settings(\/.*)?$/,
  /^\/draft\/.*$/,
  /^\/review\/.*$/,
  /^\/preview\/.*$/,
  /^\/search(\/.*)?$/,
  /^\/global-search(\/.*)?$/,
  /^\/chautari(\/.*)?$/,
  /^\/my-sanatan(\/.*)?$/,
  /^\/notifications(\/.*)?$/,
  /^\/offline-queue(\/.*)?$/,
  /^\/test(\/.*)?$/,
  /^\/smoke-test(\/.*)?$/
];

/**
 * Clean and build canonical URL using production domain only.
 */
export function buildCanonicalUrl(pathname: string, queryParams?: Record<string, string>): string {
  let cleanPath = pathname || "/";
  
  // Strip trailing slashes except root
  if (cleanPath.length > 1 && cleanPath.endsWith("/")) {
    cleanPath = cleanPath.slice(0, -1);
  }

  // Remove hash fragments or internal noise
  cleanPath = cleanPath.split("#")[0].split("?")[0];

  // Whitelisted canonical query params (e.g. pagination or language if explicitly required)
  const allowedParams = new URLSearchParams();
  if (queryParams) {
    if (queryParams.page && Number(queryParams.page) > 1) {
      allowedParams.set("page", String(queryParams.page));
    }
  }

  const queryString = allowedParams.toString();
  return `${CANONICAL_DOMAIN}${cleanPath}${queryString ? `?${queryString}` : ""}`;
}

/**
 * Determine route indexability
 */
export function isRouteIndexable(pathname: string): boolean {
  if (NOINDEX_ROUTE_PATTERNS.some(pattern => pattern.test(pathname))) {
    return false;
  }
  return INDEXABLE_ROUTE_PATTERNS.some(pattern => pattern.test(pathname));
}

/**
 * Generate Robots.txt complying with Phase 24
 */
export function generateRobotsTxt(): string {
  return `# SanatanMarga Production Robots.txt Policy
User-agent: *
Allow: /
Allow: /news/
Allow: /article/
Allow: /blog/
Allow: /sgis/
Allow: /knowledge/
Allow: /nepal-hub/
Allow: /category/
Allow: /events/
Allow: /storylines/
Allow: /about
Allow: /editorial-policy
Allow: /transparency
Allow: /authors
Allow: /contact
Allow: /privacy
Allow: /terms
Allow: /sitemap.xml
Allow: /sitemaps/

Disallow: /admin/
Disallow: /editor/
Disallow: /dashboard/
Disallow: /login
Disallow: /signup
Disallow: /account/
Disallow: /draft/
Disallow: /preview/
Disallow: /search
Disallow: /global-search
Disallow: /my-sanatan
Disallow: /notifications
Disallow: /offline-queue
Disallow: /api/

Sitemap: ${CANONICAL_DOMAIN}/sitemap.xml
`;
}

/**
 * Master Sitemap Index (/sitemap.xml) pointing to sub-sitemaps (Phase 21)
 */
export function generateMasterSitemapIndexXml(): string {
  const now = new Date().toISOString();
  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
  xml += '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';

  const sitemaps = [
    "pages.xml",
    "news.xml",
    "blog.xml",
    "sgis.xml",
    "categories.xml",
    "authors.xml"
  ];

  for (const s of sitemaps) {
    xml += '  <sitemap>\n';
    xml += `    <loc>${CANONICAL_DOMAIN}/sitemaps/${s}</loc>\n`;
    xml += `    <lastmod>${now}</lastmod>\n`;
    xml += '  </sitemap>\n';
  }

  xml += '</sitemapindex>';
  return xml;
}

/**
 * Helper to escape XML special characters
 */
function escapeXml(unsafe: string): string {
  if (!unsafe) return "";
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * Sub-sitemap generators
 */
export async function generateSubSitemapXml(type: string, dbInstance?: any, sosInstance?: any): Promise<string> {
  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
  xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1" xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">\n';

  const now = new Date().toISOString();

  if (type === "pages") {
    const staticPages = [
      { path: "/", priority: "1.0", freq: "daily" },
      { path: "/news", priority: "0.9", freq: "hourly" },
      { path: "/latest", priority: "0.9", freq: "hourly" },
      { path: "/trending", priority: "0.8", freq: "hourly" },
      { path: "/blog", priority: "0.9", freq: "daily" },
      { path: "/sgis", priority: "0.9", freq: "daily" },
      { path: "/knowledge", priority: "0.9", freq: "daily" },
      { path: "/nepal-hub", priority: "0.9", freq: "daily" },
      { path: "/events", priority: "0.8", freq: "daily" },
      { path: "/storylines", priority: "0.8", freq: "daily" },
      { path: "/models", priority: "0.7", freq: "weekly" },
      { path: "/about", priority: "0.7", freq: "monthly" },
      { path: "/editorial-policy", priority: "0.6", freq: "monthly" },
      { path: "/transparency", priority: "0.6", freq: "monthly" },
      { path: "/authors", priority: "0.7", freq: "weekly" },
      { path: "/contact", priority: "0.5", freq: "monthly" },
      { path: "/privacy", priority: "0.3", freq: "yearly" },
      { path: "/terms", priority: "0.3", freq: "yearly" }
    ];

    for (const page of staticPages) {
      xml += '  <url>\n';
      xml += `    <loc>${CANONICAL_DOMAIN}${page.path}</loc>\n`;
      xml += `    <lastmod>${now}</lastmod>\n`;
      xml += `    <changefreq>${page.freq}</changefreq>\n`;
      xml += `    <priority>${page.priority}</priority>\n`;
      xml += '  </url>\n';
    }
  } else if (type === "news") {
    // Recent 48 hours news or published news
    let articles: any[] = [];
    if (sosInstance && sosInstance.snapshotStore && sosInstance.snapshotStore["latest"]) {
      articles = sosInstance.snapshotStore["latest"].data?.articles || [];
    } else if (dbInstance) {
      try {
        const snap = await getDocs(query(collection(dbInstance, "articles"), where("status", "==", "published"), limit(200)));
        articles = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      } catch (e) {}
    }

    for (const art of articles) {
      const url = `${CANONICAL_DOMAIN}/article/${art.id}`;
      const pubDate = art.publishedAt || art.createdAt || now;
      const title = escapeXml(art.titleNepali || art.title || "समाचार");
      const lang = art.language === "en" ? "en" : "ne";

      xml += '  <url>\n';
      xml += `    <loc>${url}</loc>\n`;
      xml += `    <lastmod>${pubDate}</lastmod>\n`;
      xml += '    <news:news>\n';
      xml += '      <news:publication>\n';
      xml += '        <news:name>SanatanMarga</news:name>\n';
      xml += `        <news:language>${lang}</news:language>\n`;
      xml += '      </news:publication>\n';
      xml += `      <news:publication_date>${pubDate}</news:publication_date>\n`;
      xml += `      <news:title>${title}</news:title>\n`;
      xml += '    </news:news>\n';
      if (art.featuredImage) {
        xml += '    <image:image>\n';
        xml += `      <image:loc>${escapeXml(art.featuredImage)}</image:loc>\n`;
        xml += `      <image:title>${title}</image:title>\n`;
        xml += '    </image:image>\n';
      }
      xml += '  </url>\n';
    }
  } else if (type === "blog") {
    let blogPosts: any[] = [];
    if (dbInstance) {
      try {
        const snap = await getDocs(query(collection(dbInstance, "blog_posts"), where("status", "==", "published"), limit(200)));
        blogPosts = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      } catch (e) {}
    }
    if (blogPosts.length === 0) {
      // Seed entries for sitemap compliance
      blogPosts = [
        { slug: "sanatan-dharma-intro", title: "सनातन धर्म के हो?", updatedAt: now },
        { slug: "vedas-and-upanishads", title: "वेद र उपनिषद्‌को तत्त्वज्ञान", updatedAt: now },
        { slug: "bhagavad-gita-karma-yoga", title: "श्रीमद्भगवद्गीतामा कर्मयोग", updatedAt: now }
      ];
    }

    for (const post of blogPosts) {
      const slug = post.slug || post.id;
      xml += '  <url>\n';
      xml += `    <loc>${CANONICAL_DOMAIN}/blog/post/${slug}</loc>\n`;
      xml += `    <lastmod>${post.updatedAt || post.publishedAt || now}</lastmod>\n`;
      xml += '    <changefreq>weekly</changefreq>\n';
      xml += '    <priority>0.8</priority>\n';
      xml += '  </url>\n';
    }
  } else if (type === "sgis") {
    // Verified public manuscripts
    const manuscripts = [
      { id: "sgis-ms-001", name: "Saraswati Grantha Manuscript 001 - Rgveda Bhasya", updatedAt: now },
      { id: "sgis-ms-002", name: "Saraswati Grantha Manuscript 002 - Upanisad Commentary", updatedAt: now },
      { id: "sgis-ms-003", name: "Saraswati Grantha Manuscript 003 - Pashupatinath Inscriptions", updatedAt: now }
    ];

    for (const ms of manuscripts) {
      xml += '  <url>\n';
      xml += `    <loc>${CANONICAL_DOMAIN}/sgis/text/${ms.id}</loc>\n`;
      xml += `    <lastmod>${ms.updatedAt}</lastmod>\n`;
      xml += '    <changefreq>monthly</changefreq>\n';
      xml += '    <priority>0.8</priority>\n';
      xml += '  </url>\n';
    }
  } else if (type === "categories") {
    const categories = [
      "politics", "desh", "pradesh", "bishwo", "sports", "entertainment",
      "economy", "tech", "samachar", "marga", "sanatan", "nepal-hub"
    ];

    for (const cat of categories) {
      xml += '  <url>\n';
      xml += `    <loc>${CANONICAL_DOMAIN}/category/${cat}</loc>\n`;
      xml += `    <lastmod>${now}</lastmod>\n`;
      xml += '    <changefreq>daily</changefreq>\n';
      xml += '    <priority>0.7</priority>\n';
      xml += '  </url>\n';
    }
  } else if (type === "authors") {
    const authors = ["editorial-board", "sagar-rana", "scholar-desk"];
    for (const a of authors) {
      xml += '  <url>\n';
      xml += `    <loc>${CANONICAL_DOMAIN}/blog/author/${a}</loc>\n`;
      xml += `    <lastmod>${now}</lastmod>\n`;
      xml += '    <changefreq>weekly</changefreq>\n';
      xml += '    <priority>0.6</priority>\n';
      xml += '  </url>\n';
    }
  }

  xml += '</urlset>';
  return xml;
}

/**
 * Server-Side HTML Injector for Crawlers (Phase 28)
 * Injects <title>, <meta description>, <link canonical>, og tags, and JSON-LD directly into HTML template.
 */
export function injectSeoMetadataIntoHtml(
  htmlTemplate: string,
  meta: {
    title: string;
    description: string;
    canonicalUrl: string;
    image?: string;
    type?: string;
    noindex?: boolean;
    jsonLd?: object;
  }
): string {
  const safeTitle = escapeXml(meta.title);
  const safeDesc = escapeXml(meta.description);
  const safeUrl = meta.canonicalUrl;
  const safeImage = meta.image || `${CANONICAL_DOMAIN}/logo.png`;
  const robotsDirective = meta.noindex ? "noindex, nofollow" : "index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1";

  // Replace default <title>
  let injected = htmlTemplate.replace(
    /<title>.*?<\/title>/gi,
    `<title>${safeTitle}</title>`
  );

  // Replace default <meta name="description">
  injected = injected.replace(
    /<meta name="description" content=".*?" \/>/gi,
    `<meta name="description" content="${safeDesc}" />`
  );

  // Replace canonical link
  injected = injected.replace(
    /<link rel="canonical" href=".*?" \/>/gi,
    `<link rel="canonical" href="${safeUrl}" />`
  );

  // Replace robots directive
  injected = injected.replace(
    /<meta name="robots" content=".*?" \/>/gi,
    `<meta name="robots" content="${robotsDirective}" />`
  );

  // Inject custom JSON-LD if provided before </head>
  if (meta.jsonLd) {
    const jsonLdScript = `\n    <script type="application/ld+json">${JSON.stringify(meta.jsonLd)}</script>`;
    injected = injected.replace("</head>", `${jsonLdScript}\n  </head>`);
  }

  return injected;
}

/**
 * SEO Quality Gate for Editors (Phase 50)
 */
export interface SeoQualityGateResult {
  passed: boolean;
  score: number; // 0 - 100
  warnings: string[];
  errors: string[];
}

export function validateSeoQualityGate(article: {
  title?: string;
  excerpt?: string;
  content?: string;
  authorName?: string;
  featuredImage?: string;
  publishedAt?: string;
  slug?: string;
  seoTitle?: string;
  seoDescription?: string;
}): SeoQualityGateResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  let score = 100;

  if (!article.title || article.title.trim().length < 5) {
    errors.push("Missing or extremely short article title (min 5 characters required)");
    score -= 30;
  }

  if (!article.seoDescription && !article.excerpt && (!article.content || article.content.length < 50)) {
    warnings.push("Missing meta description / excerpt (search engines will auto-generate snippet)");
    score -= 15;
  }

  if (!article.featuredImage) {
    warnings.push("Missing featured image (OpenGraph / NewsArticle search cards recommend a high-quality image)");
    score -= 15;
  }

  if (!article.authorName) {
    warnings.push("Missing author attribution (E-E-A-T guideline compliance)");
    score -= 10;
  }

  if (article.title && article.title.toLowerCase().includes("sanatan") && (article.title.match(/sanatan/gi) || []).length > 3) {
    warnings.push("Potential keyword stuffing detected in title");
    score -= 10;
  }

  return {
    passed: errors.length === 0,
    score: Math.max(0, score),
    warnings,
    errors
  };
}
