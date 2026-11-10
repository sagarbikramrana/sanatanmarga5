import { Router, Request, Response } from "express";
import { seoDiscoveryOS } from "./seoDiscoveryOs";

export function createSitemapRouter(sos: any): Router {
  const router = Router();

  // 1. Robots.txt (Environment-aware)
  router.get("/robots.txt", (req: Request, res: Response) => {
    const env = process.env.NODE_ENV === "production" ? "production" : "preview";
    res.setHeader("Content-Type", "text/plain");
    res.send(seoDiscoveryOS.generateRobotsTxt(env));
  });

  // 2. Master Sitemap Index (/sitemap.xml)
  router.get("/sitemap.xml", (req: Request, res: Response) => {
    res.setHeader("Content-Type", "application/xml; charset=utf-8");
    const xml = seoDiscoveryOS.generateMasterSitemapIndex();
    res.send(xml);
  });

  // 3. Sub-sitemaps (/sitemaps/:type.xml)
  router.get("/sitemaps/:type.xml", (req: Request, res: Response) => {
    const type = req.params.type;
    res.setHeader("Content-Type", "application/xml; charset=utf-8");
    const xml = seoDiscoveryOS.generateSubSitemap(type, sos?.snapshotStore || sos);
    res.send(xml);
  });

  // 4. Admin / Telemetry Endpoints
  router.get("/api/seo/health", (req: Request, res: Response) => {
    const telemetry = seoDiscoveryOS.computeHealthTelemetry(sos?.snapshotStore || sos);
    res.json({
      success: true,
      data: telemetry
    });
  });

  router.get("/api/seo/diagnostics", (req: Request, res: Response) => {
    const conflicts = seoDiscoveryOS.detectCanonicalConflicts();
    const orphans = seoDiscoveryOS.detectOrphanPages();
    const redirects = seoDiscoveryOS.getRedirects();
    const telemetry = seoDiscoveryOS.computeHealthTelemetry(sos?.snapshotStore || sos);

    res.json({
      success: true,
      data: {
        telemetry,
        conflicts,
        orphans,
        redirects
      }
    });
  });

  return router;
}
