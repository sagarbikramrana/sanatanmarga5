import { useState, useEffect } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { Clock, ChevronRight, Eye, Calendar, Share2, Headphones, Play } from "lucide-react";
import { useMediaOS } from "@/src/context/MediaOSContext";
import { collection, query, where, orderBy, safeOnSnapshot as onSnapshot, limit, startAfter, getDocs } from "@/src/lib/firebase";
import { db } from "@/src/lib/firebase";
import { useAuth } from "@/src/lib/auth";
import { shareToChautari } from "@/src/utils/shareUtils";
import Header from "@/src/components/layout/Header";
import SEOHead from "@/src/components/common/SEOHead";
import Footer from "@/src/components/layout/Footer";
import Sidebar from "@/src/components/layout/Sidebar";
import FloatingActions from "@/src/components/layout/FloatingActions";
import TopicsIndex from "@/src/components/news/TopicsIndex";
import CreatePostModal from "@/src/components/community/CreatePostModal";
import { formatDate } from "@/src/lib/utils";
import { getDocsWithCacheFallback, handleFirestoreError, OperationType } from "@/src/lib/firebase";
import type { Article } from "@/src/types";
import { snapshotEngine } from "@/src/services/snapshotEngine";
import { normalizeArticleCategory } from "@/src/constants/categories";
import { continuityEngine } from "@/src/lib/continuityEngine";
import { useLanguage } from "@/src/context/LanguageContext";

import { SidebarGridSkeleton } from "@/src/components/ui/PageLoaders";

export default function CategoryPage() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t, language, getLocalized } = useLanguage();
  const { playQueue } = useMediaOS();
  const [articles, setArticles] = useState<Article[]>([]);
  const [categoryNameNepali, setCategoryNameNepali] = useState<string>("");
  const [categoryNameEnglish, setCategoryNameEnglish] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [lastDoc, setLastDoc] = useState<any>(null);
  const [hasMore, setHasMore] = useState(true);
  const [showTopics, setShowTopics] = useState(false);
  const [selectedArticleToShare, setSelectedArticleToShare] = useState<Article | null>(null);
  const [showShareModal, setShowShareModal] = useState(false);
  const [resolvedCatId, setResolvedCatId] = useState<string>("");
  const [resolvedCatSlug, setResolvedCatSlug] = useState<string>("");

  useEffect(() => {
    if (!slug) return;

    const loadCategoryData = async () => {
      try {
        setLoading(true);
        const norm = normalizeArticleCategory(slug);
        const normCatId = norm.categoryId;
        const normCatSlug = norm.categorySlug;
        const normCatName = norm.categoryName;

        const catSnap = await snapshotEngine.getCategoriesSnapshot();
        const foundCat = catSnap.categories?.find(c => 
          (c.slug || "").toLowerCase() === slug.toLowerCase() || 
          (c.id || "").toLowerCase() === slug.toLowerCase() ||
          (c.slug || "").toLowerCase() === normCatSlug.toLowerCase() ||
          (c.id || "").toLowerCase() === normCatId.toLowerCase() ||
          (c.nameNepali || "").toLowerCase() === slug.toLowerCase() ||
          (c.nameEnglish || "").toLowerCase() === slug.toLowerCase()
        );
        
        const catId = foundCat?.id || normCatId || slug;
        const catSlug = foundCat?.slug || normCatSlug || slug;
        const nameNp = foundCat?.nameNepali || normCatName || slug;
        const nameEn = foundCat?.nameEnglish || (normCatSlug.charAt(0).toUpperCase() + normCatSlug.slice(1));
        setCategoryNameNepali(nameNp);
        setCategoryNameEnglish(nameEn);
        setResolvedCatId(catId);
        setResolvedCatSlug(catSlug);

        // Try to get cached articles first for immediate visual feedback
        let initialArticles: Article[] = [];
        const cachedArticles = 
          catSnap.categoryArticles?.[catSlug] || 
          catSnap.categoryArticles?.[catId] || 
          catSnap.categoryArticles?.[normCatSlug] || 
          catSnap.categoryArticles?.[normCatId] || 
          catSnap.categoryArticles?.[slug];

        if (cachedArticles && cachedArticles.length > 0) {
          initialArticles = cachedArticles;
        } else {
          const hpSnap = await snapshotEngine.getHomepageSnapshot();
          const hpCatArticles = 
            hpSnap.categoryArticles?.[catSlug] || 
            hpSnap.categoryArticles?.[catId] || 
            hpSnap.categoryArticles?.[normCatSlug] || 
            hpSnap.categoryArticles?.[normCatId] || 
            hpSnap.categoryArticles?.[slug];

          if (hpCatArticles && hpCatArticles.length > 0) {
            initialArticles = hpCatArticles;
          } else {
            // Filter from latest news pool
            const filteredLatest = (hpSnap.latestNews || []).filter((a: any) => {
              const aCatId = (a.categoryId || "").toLowerCase();
              const aCat = (a.category || "").toLowerCase();
              const aCatSlug = (a.categorySlug || "").toLowerCase();
              const aCatName = (a.categoryName || "").toLowerCase();
              const targetSlug = catSlug.toLowerCase();
              const targetId = catId.toLowerCase();
              const targetName = nameNp.toLowerCase();
              const aNorm = normalizeArticleCategory(aCatId || aCatSlug || aCat || aCatName);

              return (
                aCatId === targetSlug ||
                aCatId === targetId ||
                aCat === targetSlug ||
                aCat === targetId ||
                aCatSlug === targetSlug ||
                aNorm.categorySlug.toLowerCase() === normCatSlug.toLowerCase() ||
                (targetName && (aCatName === targetName || aCat === targetName))
              );
            });
            if (filteredLatest.length > 0) {
              initialArticles = filteredLatest;
            }
          }
        }

        if (initialArticles.length > 0) {
          setArticles(initialArticles);
          setLoading(false);
        }

        // Query Firestore if active, or use continuityEngine immediately
        try {
          const q = query(
            collection(db, "articles"),
            where("categoryId", "in", [catId, catSlug]),
            where("status", "==", "published"),
            orderBy("createdAt", "desc"),
            limit(20)
          );
          const snap = await getDocsWithCacheFallback(q);
          const dbArticles = snap.docs.map(d => ({ id: d.id, ...d.data() } as Article));
          if (dbArticles.length > 0) {
            setArticles(dbArticles);
            setLastDoc(snap.docs[snap.docs.length - 1]);
            setHasMore(snap.docs.length === 20);
          } else if (initialArticles.length === 0) {
            const fallbackArticles = await continuityEngine.getRecentArticles(20, catId || catSlug);
            setArticles(fallbackArticles);
          }
        } catch (qErr) {
          const fallbackArticles = await continuityEngine.getRecentArticles(20, catId || catSlug);
          if (fallbackArticles.length > 0) {
            setArticles(fallbackArticles);
          } else if (initialArticles.length === 0) {
            setArticles([]);
          }
        }
      } catch (err) {
        console.warn("Category load error:", err);
        const fallbackArticles = await continuityEngine.getRecentArticles(20, slug);
        setArticles(fallbackArticles);
      } finally {
        setLoading(false);
      }
    };

    loadCategoryData();
  }, [slug]);

  const isValidDocSnap = (d: any) => {
    return Boolean(d && typeof d === 'object' && typeof d !== 'function' && typeof d.data === 'function' && d.id);
  };

  const loadMore = async () => {
    if (!lastDoc || !resolvedCatId || !isValidDocSnap(lastDoc)) return;

    try {
      const qConstraints: any[] = [
        where("categoryId", "in", [resolvedCatId, resolvedCatSlug]),
        where("status", "==", "published"),
        orderBy("createdAt", "desc"),
      ];
      if (isValidDocSnap(lastDoc)) {
        qConstraints.push(startAfter(lastDoc));
      }
      qConstraints.push(limit(10));

      const q = query(
        collection(db, "articles"),
        ...qConstraints
      );

      let snapshot;
      try {
        snapshot = await getDocsWithCacheFallback(q);
      } catch (err) {
        const fallbackConstraints: any[] = [
          where("categoryId", "==", resolvedCatId),
          where("status", "==", "published"),
          orderBy("createdAt", "desc"),
        ];
        if (isValidDocSnap(lastDoc)) {
          fallbackConstraints.push(startAfter(lastDoc));
        }
        fallbackConstraints.push(limit(10));

        const fallbackQ = query(
          collection(db, "articles"),
          ...fallbackConstraints
        );
        snapshot = await getDocsWithCacheFallback(fallbackQ);
      }

      const newArticles = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Article));
      setArticles(prev => {
        const existingIds = new Set(prev.map(a => a.id));
        const filteredNew = newArticles.filter(a => !existingIds.has(a.id));
        return [...prev, ...filteredNew];
      });
      setLastDoc(snapshot.docs[snapshot.docs.length - 1]);
      setHasMore(snapshot.docs.length === 10);
    } catch (err) {
      console.error("Error loading more articles:", err);
    }
  };

  const handleShare = (e: React.MouseEvent, article: Article) => {
    e.preventDefault();
    e.stopPropagation();
    if (!user) return navigate("/login");
    setSelectedArticleToShare(article);
    setShowShareModal(true);
  };

  const displayCategoryName = language === 'en' 
    ? (categoryNameEnglish || categoryNameNepali || slug || "Category")
    : (categoryNameNepali || categoryNameEnglish || slug || "विधा");

  if (loading) return <SidebarGridSkeleton />;

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <SEOHead
        title={language === 'en' ? `${displayCategoryName} - Latest News & Analysis` : `${displayCategoryName} - ताजा समाचार र विचार`}
        description={language === 'en' 
          ? `Top news, analysis, reports and opinion stories in ${displayCategoryName} on Sanatan Marga.`
          : `'${displayCategoryName}' विधा अन्तर्गतका प्रमुख नेपाली समाचार, विश्लेषण, विचार तथा विश्लेषण सामग्रीहरू।`}
        url={`/category/${slug}`}
        keywords={[displayCategoryName, "नेपाली समाचार", "Sanatan Marga", "ताजा खबर", "Nepal News"]}
        jsonLd={[
          {
            "@context": "https://schema.org",
            "@type": "CollectionPage",
            "name": `${displayCategoryName} ${language === 'en' ? 'News' : 'समाचार'}`,
            "url": `https://sanatanmarga.com/category/${slug}`
          },
          {
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            "itemListElement": [
              {
                "@type": "ListItem",
                "position": 1,
                "name": language === 'en' ? "Home" : "गृहपृष्ठ",
                "item": "https://sanatanmarga.com/"
              },
              {
                "@type": "ListItem",
                "position": 2,
                "name": displayCategoryName,
                "item": `https://sanatanmarga.com/category/${slug}`
              }
            ]
          }
        ]}
      />
      <Header />
      
      <main className="flex-grow py-12">
        <div className="container-custom">
          {/* Breadcrumbs */}
          <div className="flex items-center gap-2 text-xxs font-black text-muted-text uppercase tracking-widest mb-10">
            <Link to="/" className="hover:text-primary transition-colors">{t("home")}</Link>
            <ChevronRight size={12} />
            <span className="text-card-foreground uppercase">{displayCategoryName}</span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-16">
            <div className="lg:col-span-8">
              <div className="flex flex-col gap-6 mb-16">
                <div className="flex items-center gap-4">
                  <span className="bg-primary text-white text-xxs font-black px-4 py-1.5 rounded-full uppercase tracking-widest shadow-lg shadow-primary/20">
                    {language === 'en' ? "Category Archive" : "विधा आर्काइभ"}
                  </span>
                  <div className="h-px flex-grow bg-border-theme"></div>
                </div>
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 md:gap-6">
                  <div className="space-y-2">
                    <h1 className="text-4xl md:text-7xl font-black text-card-foreground tracking-tight uppercase">
                      {displayCategoryName}
                    </h1>
                    {articles.length > 0 && (
                      <button
                        onClick={() => playQueue(articles, `🎧 ${displayCategoryName} — Category Queue`)}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs shadow-md transition-all cursor-pointer"
                      >
                        <Headphones size={16} />
                        <Play size={12} className="fill-current" />
                        <span>{language === 'en' ? 'Listen to This Page' : 'यस पृष्ठका समाचार सुन्नुहोस्'}</span>
                      </button>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-[10px] md:text-xs font-black text-muted-text uppercase tracking-widest pb-1 md:pb-2">
                    <Calendar size={16} className="text-primary" />
                    <span>
                      {language === 'en' 
                        ? `Total ${articles.length} Stories`
                        : `कुल ${articles.length} समाचारहरू`}
                    </span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                {articles.length > 0 ? articles.map((article, index) => {
                  const title = getLocalized(article, 'title');
                  const excerpt = getLocalized(article, 'excerpt');
                  return (
                    <Link 
                      key={`${article.id || 'article'}-${index}`} 
                      id={`article-${article.id}`}
                      to={`/article/${article.id}`} 
                      className="group flex flex-col gap-6 bg-card p-5 rounded-3xl border border-border-theme shadow-sm hover:shadow-2xl hover:shadow-black/10 transition-all duration-500"
                    >
                      <div className="relative aspect-[16/10] overflow-hidden rounded-2xl shadow-lg border border-border-theme/50">
                        <img 
                          src={article.featuredImage || null} 
                          alt={title}
                          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-1000"
                          referrerPolicy="no-referrer"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                      </div>
                      <div className="flex flex-col gap-4 px-2">
                        <h2 className="text-2xl font-black text-card-foreground group-hover:text-primary transition-colors leading-[1.2] line-clamp-2 tracking-tight">
                          {title}
                        </h2>
                        <p className="text-muted-text text-sm leading-relaxed line-clamp-3 font-medium">
                          {excerpt}
                        </p>
                        <div className="flex items-center justify-between pt-6 border-t border-border-theme">
                          <div className="flex items-center gap-4 text-xxs font-black text-muted-text uppercase tracking-widest">
                            <span className="flex items-center gap-1.5"><Clock size={14} className="text-primary" /> {formatDate(article.createdAt, language)}</span>
                            <span className="flex items-center gap-1.5"><Eye size={14} className="text-primary" /> {article.views}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <button 
                              onClick={(e) => handleShare(e, article)}
                              className="w-8 h-8 rounded-full bg-muted-area/50 flex items-center justify-center hover:bg-primary/10 text-muted-text hover:text-primary transition-all cursor-pointer"
                              title={language === 'en' ? "Share to Chautari" : "चौतारीमा साझा गर्नुहोस्"}
                            >
                              <Share2 size={14} />
                            </button>
                            <div className="w-8 h-8 rounded-full bg-muted-area/50 flex items-center justify-center group-hover:bg-primary group-hover:text-white transition-all text-muted-text">
                              <ChevronRight size={16} />
                            </div>
                          </div>
                        </div>
                      </div>
                    </Link>
                  );
                }) : (
                  <div className="col-span-full py-32 text-center flex flex-col items-center gap-6">
                    <div className="w-20 h-20 bg-muted-area/30 rounded-full flex items-center justify-center text-muted-text">
                      <Calendar size={40} />
                    </div>
                    <p className="text-muted-text font-black uppercase tracking-widest">
                      {language === 'en' ? "No stories found in this category." : "यस विधामा कुनै समाचार भेटिएन।"}
                    </p>
                  </div>
                )}
              </div>

              {/* Pagination / Load More */}
              {hasMore && articles.length > 0 && (
                <div className="mt-20 flex justify-center">
                  <button 
                    onClick={loadMore}
                    className="bg-card text-card-foreground border border-border-theme px-12 py-4 rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-primary hover:text-white transition-all shadow-xl flex items-center gap-3 group cursor-pointer"
                  >
                    {language === 'en' ? "Load More Stories" : "थप समाचार लोड गर्नुहोस्"}
                    <ChevronRight size={18} className="group-hover:translate-x-1 transition-transform" />
                  </button>
                </div>
              )}
            </div>

            <div className="lg:col-span-4">
              <div className="sticky top-[160px] transition-all duration-300">
                <Sidebar onShare={(article) => {
                  setSelectedArticleToShare(article);
                  setShowShareModal(true);
                }} />
              </div>
            </div>
          </div>
        </div>
      </main>

      <Footer />

      <CreatePostModal 
        isOpen={showShareModal}
        onClose={() => setShowShareModal(false)}
        initialData={selectedArticleToShare ? {
          title: language === 'en' ? `Discussion on: ${getLocalized(selectedArticleToShare, 'title')}` : `समाचार बारे अपडेट: ${selectedArticleToShare.title}`,
          content: `${getLocalized(selectedArticleToShare, 'excerpt')}\n\n${language === 'en' ? "What are your thoughts on this? Let's discuss." : "यस बारे तपाईंको के धारणा छ? छलफल गरौं।"}`,
          imageUrl: selectedArticleToShare.featuredImage,
          category: "News",
          linkedArticleId: selectedArticleToShare.id
        } : undefined}
      />

      <FloatingActions 
        articles={articles.map(a => ({ id: a.id, title: getLocalized(a, 'title') || a.title }))} 
        onOpenTopics={() => setShowTopics(true)} 
      />
      <TopicsIndex articles={articles} isOpen={showTopics} onClose={() => setShowTopics(false)} />
    </div>
  );
}
