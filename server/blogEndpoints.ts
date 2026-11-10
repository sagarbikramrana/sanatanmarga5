import { Router, Request, Response } from "express";
import { CANONICAL_BLOG_CATEGORIES, CANONICAL_BLOG_POSTS, CANONICAL_BLOG_SERIES } from "../src/data/sanatanBlogData";
import { BlogPost, BlogCategory, BlogSeries, BlogHomepageSnapshot } from "../src/types";
import { GoogleGenAI } from "@google/genai";
import { generateContentWithFallback } from "./aiModels";

let blogSnapshotCache: BlogHomepageSnapshot | null = null;
let lastSnapshotBuildTime = 0;
const SNAPSHOT_TTL = 300 * 1000; // 5 minutes

let inMemoryPosts: BlogPost[] = [...CANONICAL_BLOG_POSTS];
let inMemoryCategories: BlogCategory[] = [...CANONICAL_BLOG_CATEGORIES];
let inMemorySeries: BlogSeries[] = [...CANONICAL_BLOG_SERIES];

export function buildBlogHomepageSnapshot(): BlogHomepageSnapshot {
  const published = inMemoryPosts.filter(p => p.status === "published");
  const snapshot: BlogHomepageSnapshot = {
    generatedAt: new Date().toISOString(),
    version: "4.2.8",
    featuredEssay: published.find(p => p.featured) || published[0] || null,
    featuredTopics: inMemoryCategories.filter(c => c.isActive && c.isFeatured),
    latestPosts: published,
    scripturePosts: published.filter(p => p.categoryId === "cat_vedas_upanishads" || p.categoryId === "cat_gita"),
    philosophyPosts: published.filter(p => p.categoryId === "cat_darshan" || p.categoryId === "cat_dharma"),
    traditionPosts: published.filter(p => p.categoryId === "cat_festivals" || p.categoryId === "cat_nepal_himalayas"),
    yogaSadhanaPosts: published.filter(p => p.categoryId === "cat_yoga_sadhana"),
    templeHeritagePosts: published.filter(p => p.categoryId === "cat_temples_tirtha"),
    popularPosts: [...published].sort((a, b) => (b.views || 0) - (a.views || 0)),
    featuredSeries: inMemorySeries,
    categories: inMemoryCategories.filter(c => c.isActive)
  };
  blogSnapshotCache = snapshot;
  lastSnapshotBuildTime = Date.now();
  return snapshot;
}

export function createBlogRouter(db?: any): Router {
  const router = Router();

  // 1. Snapshot OS: Blog Homepage Snapshot (Public, Read-Many)
  router.get("/snapshot/homepage", (req: Request, res: Response) => {
    if (!blogSnapshotCache || (Date.now() - lastSnapshotBuildTime > SNAPSHOT_TTL)) {
      buildBlogHomepageSnapshot();
    }
    res.setHeader("Cache-Control", "public, max-age=60, s-maxage=300, stale-while-revalidate=600");
    return res.json(blogSnapshotCache);
  });

  // 2. Categories
  router.get("/categories", (req: Request, res: Response) => {
    return res.json({ categories: inMemoryCategories });
  });

  // 3. Category with posts
  router.get("/category/:slug", (req: Request, res: Response) => {
    const slug = req.params.slug;
    const category = inMemoryCategories.find(c => c.slug === slug || c.id === slug) || null;
    const posts = inMemoryPosts.filter(p => 
      p.status === "published" && (p.categorySlug === slug || p.categoryId === category?.id)
    );
    return res.json({ category, posts });
  });

  // 4. Series
  router.get("/series", (req: Request, res: Response) => {
    return res.json({ series: inMemorySeries });
  });

  // 5. Series with ordered posts
  router.get("/series/:slug", (req: Request, res: Response) => {
    const slug = req.params.slug;
    const series = inMemorySeries.find(s => s.slug === slug || s.id === slug) || null;
    const posts = inMemoryPosts.filter(p => 
      p.status === "published" && (p.seriesSlug === slug || p.seriesId === series?.id)
    ).sort((a, b) => (a.seriesOrder || 0) - (b.seriesOrder || 0));
    return res.json({ series, posts });
  });

  // 6. Single Post
  router.get("/posts/:slugOrId", (req: Request, res: Response) => {
    const slugOrId = req.params.slugOrId;
    const post = inMemoryPosts.find(p => p.slug === slugOrId || p.id === slugOrId);
    if (!post) {
      return res.status(404).json({ error: "Post not found" });
    }
    // Increment view count in memory
    post.views = (post.views || 0) + 1;
    return res.json({ post });
  });

  // 7. Save / Update Post
  router.post("/posts", (req: Request, res: Response) => {
    const body: BlogPost = req.body;
    if (!body || !body.title) {
      return res.status(400).json({ error: "Invalid post payload" });
    }

    const idx = inMemoryPosts.findIndex(p => p.id === body.id || p.slug === body.slug);
    if (idx >= 0) {
      inMemoryPosts[idx] = { ...inMemoryPosts[idx], ...body, updatedAt: new Date().toISOString() };
    } else {
      inMemoryPosts.unshift(body);
    }

    // Invalidate snapshot on modification
    buildBlogHomepageSnapshot();
    return res.json({ success: true, post: body });
  });

  // 8. Publish Post
  router.post("/posts/:id/publish", (req: Request, res: Response) => {
    const id = req.params.id;
    const { publishedBy } = req.body;
    const post = inMemoryPosts.find(p => p.id === id);
    if (post) {
      post.status = "published";
      post.publishedBy = publishedBy || "editor";
      post.publishedAt = new Date().toISOString();
      buildBlogHomepageSnapshot();
      return res.json({ success: true, post });
    }
    return res.status(404).json({ error: "Post not found" });
  });

  // 9. AI Assist for Sanatan Blog (Gemini 2.5)
  router.post("/ai-assist", async (req: Request, res: Response) => {
    const { prompt, taskType } = req.body;
    if (!prompt) {
      return res.status(400).json({ error: "Prompt is required" });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(503).json({ 
        success: false, 
        code: "AI_NOT_CONFIGURED",
        retryable: false,
        error: "GEMINI_API_KEY is not configured on the server."
      });
    }

    try {
      const ai = new GoogleGenAI({ apiKey });
      let systemInstruction = "You are a senior Sanatan Dharma philosopher, Vedic scholar, and Sanskrit philologist. Provide scholarly, respectful, authentic, and citation-backed knowledge.";
      
      let userPrompt = prompt;
      if (taskType === "outline") {
        userPrompt = `Generate a detailed markdown essay outline for a long-form Sanatan Dharma blog post on: "${prompt}". Include section headings, key philosophical concepts, and suggested Sanskrit scriptures to cite.`;
      } else if (taskType === "translation") {
        userPrompt = `Translate the following scholarly Sanatan essay text into high-register, authentic Nepali (Devanagari) suitable for formal publication:\n\n${prompt}`;
      } else if (taskType === "scripture_lookup") {
        userPrompt = `Provide relevant Upanishad, Bhagavad Gita, or Vedic verses related to: "${prompt}". Include Sanskrit Devanagari text, transliteration, and English explanation.`;
      }

      const response = await generateContentWithFallback(
        ai,
        userPrompt,
        { systemInstruction, modelPolicyId: "NEWSROOM_PRIMARY" },
        "blog_ai_assist"
      );

      const resultText = response.text || "";
      return res.json({ success: true, result: resultText });
    } catch (e: any) {
      console.error("[Blog AI Assist Error]:", e);
      const isQuota = e?.status === 429 || String(e?.message || "").includes("429") || String(e?.message || "").includes("RESOURCE_EXHAUSTED");
      return res.status(isQuota ? 429 : 503).json({
        success: false,
        code: "AI_TEMPORARILY_UNAVAILABLE",
        retryable: true,
        error: "AI generation failed. Service is temporarily unavailable."
      });
    }
  });

  return router;
}
