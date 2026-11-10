/**
 * SANATANMARGA 5.0 — PHASE 2C.1 SEO & DISCOVERY OS CERTIFICATION SMOKE
 * Raw HTML SEO Injection, Sitemap Generation, Canonical Resolvers & Quality Verification
 */

import { seoDiscoveryOS, CANONICAL_DOMAIN, NEWS_SITEMAP_FRESHNESS_HOURS } from "../server/seoDiscoveryOs.js";
import { serverFeatureControlService } from "../server/featureControlService.js";
import { snapshotOS } from "../server/snapshotOs.js";

let passed = 0;
let failed = 0;

function assert(condition: boolean, msg: string) {
  if (condition) {
    console.log(`✅ [PASS] ${msg}`);
    passed++;
  } else {
    console.error(`❌ [FAIL] ${msg}`);
    failed++;
  }
}

async function runPhase2C1CertificationSmoke() {
  console.log("=================================================");
  console.log("SANATANMARGA 5.0 — PHASE 2C.1 SEO CERTIFICATION SMOKE");
  console.log("=================================================");

  const baseHtml = `<!doctype html><html lang="ne"><head><meta charset="UTF-8"><title>Vite App</title></head><body><div id="root"></div></body></html>`;

  // 1. Raw HTML SEO for Homepage
  const homeInjected = seoDiscoveryOS.injectServerSeo(baseHtml, "/");
  assert(homeInjected.includes("<title>SanatanMarga"), "1. Homepage HTML contains title in raw HTML");
  assert(homeInjected.includes(`<link rel="canonical" href="${CANONICAL_DOMAIN}/"`), "2. Homepage HTML contains canonical tag in raw HTML");
  assert(homeInjected.includes(`"name":"SanatanMarga"`), "3. Homepage HTML contains Organization / WebSite JSON-LD");

  // 2. Raw HTML SEO for Published Article
  const mockArticle = {
    id: "art-ancient-temples-heritage",
    slug: "ancient-temples-heritage",
    titleNepali: "काठमाडौँका प्राचीन मन्दिरहरूको ऐतिहासिक सम्पदा",
    title: "Historical Heritage of Ancient Temples in Kathmandu",
    content: "काठमाडौँ उपत्यकाका ऐतिहासिक मन्दिरहरूको संरक्षण सम्बन्धी अनुसन्धान।",
    excerpt: "काठमाडौँ उपत्यकाका ऐतिहासिक मन्दिरहरूको विस्तृत अनुसन्धान र सांस्कृतिक महत्व।",
    category: "heritage",
    status: "published",
    featuredImage: "https://sanatanmarga.com/media/temple.jpg",
    authorName: "Dr. Sagar Rana",
    authorId: "dr-sagar-rana",
    publishedAt: new Date(Date.now() - 3600000).toISOString(),
    updatedAt: new Date().toISOString()
  };

  const mockSnapshotStore = {
    latest: {
      data: {
        articles: [mockArticle]
      }
    },
    events: {
      data: {
        events: [
          {
            id: "indra-jatra-2026",
            titleNepali: "इन्द्रजात्रा महोत्सव २०८३",
            descriptionNepali: "काठमाडौँमा मनाइने ऐतिहासिक इन्द्रजात्रा पर्व।",
            date: "2026-09-25T00:00:00.000Z",
            location: "Basantapur Durbar Square, Kathmandu"
          }
        ]
      }
    }
  };

  const articleInjected = seoDiscoveryOS.injectServerSeo(baseHtml, "/article/ancient-temples-heritage", mockSnapshotStore);
  assert(articleInjected.includes("काठमाडौँका प्राचीन मन्दिरहरूको ऐतिहासिक सम्पदा"), "4. Article HTML contains headline in raw HTML");
  assert(articleInjected.includes(`<link rel="canonical" href="${CANONICAL_DOMAIN}/article/ancient-temples-heritage"`), "5. Article HTML contains canonical URL in raw HTML");
  assert(articleInjected.includes(`"datePublished":"${mockArticle.publishedAt}"`), "6. Article HTML contains immutable datePublished in JSON-LD");
  assert(articleInjected.includes(`"author":{"@type":"Person"`), "7. Article HTML links to canonical Person author in JSON-LD");

  // 3. Draft & Internal Indexing Safety Check
  const draftInjected = seoDiscoveryOS.injectServerSeo(baseHtml, "/admin/system-health");
  assert(draftInjected.includes(`content="noindex, nofollow"`), "8. Admin route is injected with noindex, nofollow in raw HTML");

  const draftEval = seoDiscoveryOS.evaluateIndexability("/draft/sample-post");
  assert(!draftEval.isIndexable && draftEval.robotsDirective.includes("noindex"), "9. /draft route fails closed to noindex");

  // 4. Sitemap Validation
  const masterSitemap = seoDiscoveryOS.generateMasterSitemapIndex();
  assert(masterSitemap.includes("<sitemapindex"), "10. Master sitemap is valid XML sitemapindex");
  assert(masterSitemap.includes("news.xml") && masterSitemap.includes("articles.xml"), "11. Master sitemap indexes news.xml and articles.xml");

  const newsSitemap = seoDiscoveryOS.generateSubSitemap("news", mockSnapshotStore);
  assert(newsSitemap.includes("<news:publication>"), "12. News sitemap contains Google News XML elements");
  assert(newsSitemap.includes("ancient-temples-heritage"), "13. News sitemap includes recent published article");

  const articlesSitemap = seoDiscoveryOS.generateSubSitemap("articles", mockSnapshotStore);
  assert(articlesSitemap.includes(`<loc>${CANONICAL_DOMAIN}/article/ancient-temples-heritage</loc>`), "14. Articles sitemap contains canonical URL");
  assert(!articlesSitemap.includes("/admin") && !articlesSitemap.includes("/draft"), "15. Articles sitemap excludes admin and draft routes");

  // 5. News Sitemap Freshness Policy
  assert(NEWS_SITEMAP_FRESHNESS_HOURS === 48, "16. News sitemap freshness policy is centralized at 48 hours");

  // 6. Knowledge Indexability Policy
  const knowledgeEval = seoDiscoveryOS.evaluateIndexability({
    entityType: "KNOWLEDGE_ENTITY",
    entityId: "k_pashupatinath",
    slug: "pashupatinath",
    canonicalUrl: `${CANONICAL_DOMAIN}/knowledge/pashupatinath`,
    title: "पशुपतिनाथ मन्दिर",
    description: "काठमाडौँको ऐतिहासिक तथा धार्मिक पशुपतिनाथ मन्दिरको विस्तृत विवरण।",
    language: "ne",
    publisherName: "SanatanMarga",
    publisherLogo: `${CANONICAL_DOMAIN}/logo.png`,
    status: "published",
    featureKey: "knowledge.base"
  });
  assert(knowledgeEval.isIndexable, "17. Verified substantive Knowledge entity is indexable");

  // 7. Canonical URL Engine
  const canon1 = seoDiscoveryOS.buildCanonicalUrl("/article/news-1");
  const canon2 = seoDiscoveryOS.buildCanonicalUrl("/article/news-1?utm_source=facebook&utm_campaign=viral");
  const canon3 = seoDiscoveryOS.buildCanonicalUrl("/article/news-1/");
  assert(canon1 === canon2 && canon1 === canon3, "18. Canonical URL engine normalizes query parameters and trailing slashes");

  // 8. HTML / JSON-LD Escape Security
  const maliciousEntity = {
    entityType: "ARTICLE" as const,
    entityId: "art_malicious",
    slug: "xss-test",
    canonicalUrl: `${CANONICAL_DOMAIN}/article/xss-test`,
    title: 'Vedic Guide </script><script>alert("xss")</script>',
    description: 'Vedic summary with <b>HTML</b> and "quotes" & ampersands.',
    language: "ne" as const,
    publisherName: "SanatanMarga",
    publisherLogo: `${CANONICAL_DOMAIN}/logo.png`,
    status: "published" as const
  };
  const malHtml = seoDiscoveryOS.injectServerSeo(baseHtml, "/article/xss-test", { latest: { data: { articles: [maliciousEntity] } } });
  assert(!malHtml.includes('</script><script>alert("xss")</script>'), "19. Malicious closing script tags in JSON-LD are escaped");
  assert(malHtml.includes('\\u003c/script\\u003e') || malHtml.includes('&lt;/script&gt;') || malHtml.includes('<\\/script>'), "20. XSS payload safely neutralized");

  // 9. Snapshot Authority Preservation
  const healthTelemetry = seoDiscoveryOS.computeHealthTelemetry(mockSnapshotStore);
  assert(typeof healthTelemetry.indexableCount === "number", "21. SEO Health telemetry indexable count is computed");
  assert(typeof healthTelemetry.canonicalConflictsCount === "number", "22. SEO Health telemetry canonical conflict count is computed");

  console.log("=================================================");
  console.log(`PHASE 2C.1 SMOKE SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log("=================================================");

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runPhase2C1CertificationSmoke();
