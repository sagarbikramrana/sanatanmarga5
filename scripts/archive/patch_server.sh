#!/bin/bash

# Find line number of app.get("/api/health"
LINE=$(grep -n 'app.get("/api/health"' server.ts | cut -d: -f1)

# Create the patch content
cat << 'PATCH_CONTENT' > patch_content.txt
  // --- HOMEPAGE CACHE ---
  let homepageDataCache = {
    data: null as any,
    lastFetched: 0
  };

  app.get("/api/homepage-data", async (req, res) => {
    try {
      const now = Date.now();
      // Cache for 5 minutes
      if (homepageDataCache.data && (now - homepageDataCache.lastFetched < 5 * 60 * 1000)) {
        return res.json(homepageDataCache.data);
      }

      const layoutSnap = await getDocs(query(collection(db, "settings")));
      let layout = null;
      layoutSnap.forEach(d => {
        if (d.id === "homepage_layout") layout = d.data().sections;
      });

      const categoriesSnap = await getDocs(query(collection(db, "categories"), orderBy("order", "asc")));
      const categories = categoriesSnap.docs.map(d => ({ id: d.id, ...d.data() })).filter((c: any) => !c.isHidden);

      const categorySlugs = categories.map((c: any) => c.slug);
      let categoryArticles: Record<string, any[]> = {};
      
      if (categorySlugs.length > 0) {
        const artQ = query(
          collection(db, "articles"),
          where("status", "==", "published"),
          where("categoryId", "in", categorySlugs.slice(0, 30)),
          orderBy("createdAt", "desc"),
          limit(60)
        );
        const artSnap = await getDocs(artQ);
        artSnap.docs.forEach(doc => {
          const article = { id: doc.id, ...doc.data() } as any;
          if (article.createdAt && article.createdAt.toDate) {
             article.createdAt = article.createdAt.toDate().toISOString();
          }
          if (!categoryArticles[article.categoryId]) categoryArticles[article.categoryId] = [];
          if (categoryArticles[article.categoryId].length < 6) {
            categoryArticles[article.categoryId].push(article);
          }
        });
      }

      const featuredQ = query(
        collection(db, "articles"),
        where("status", "==", "published"),
        where("isFeatured", "==", true),
        orderBy("createdAt", "desc"),
        limit(5)
      );
      const featuredSnap = await getDocs(featuredQ);
      const featuredArticles = featuredSnap.docs.map(doc => {
         const data = { id: doc.id, ...doc.data() } as any;
         if (data.createdAt && data.createdAt.toDate) data.createdAt = data.createdAt.toDate().toISOString();
         return data;
      });

      const latestQ = query(
        collection(db, "articles"),
        where("status", "==", "published"),
        orderBy("createdAt", "desc"),
        limit(5)
      );
      const latestSnap = await getDocs(latestQ);
      const latestNews = latestSnap.docs.map(doc => {
         const data = { id: doc.id, ...doc.data() } as any;
         if (data.createdAt && data.createdAt.toDate) data.createdAt = data.createdAt.toDate().toISOString();
         return data;
      });

      const videoQ = query(
        collection(db, "articles"),
        where("status", "==", "published"),
        where("videoUrl", "!=", ""),
        orderBy("videoUrl"),
        orderBy("createdAt", "desc"),
        limit(4)
      );
      const videoSnap = await getDocs(videoQ);
      const videoNews = videoSnap.docs.map(doc => {
         const data = { id: doc.id, ...doc.data() } as any;
         if (data.createdAt && data.createdAt.toDate) data.createdAt = data.createdAt.toDate().toISOString();
         return data;
      });

      const mostReadQ = query(
        collection(db, "articles"),
        where("status", "==", "published"),
        orderBy("views", "desc"),
        limit(20)
      );
      const mostReadSnap = await getDocs(mostReadQ);
      const mostReadNews = mostReadSnap.docs.map(doc => {
         const data = { id: doc.id, ...doc.data() } as any;
         if (data.createdAt && data.createdAt.toDate) data.createdAt = data.createdAt.toDate().toISOString();
         return data;
      });

      homepageDataCache.data = {
        layout,
        categories,
        categoryArticles,
        featuredArticles,
        latestNews,
        videoNews,
        mostReadNews
      };
      homepageDataCache.lastFetched = now;

      res.json(homepageDataCache.data);
    } catch (error: any) {
      console.error("Error fetching homepage data:", error);
      res.status(500).json({ error: error.message });
    }
  });

PATCH_CONTENT

# Insert the patch content before the line
awk -v n="$LINE" -v f="patch_content.txt" 'NR == n {while (getline line < f) print line} 1' server.ts > temp.ts
mv temp.ts server.ts

