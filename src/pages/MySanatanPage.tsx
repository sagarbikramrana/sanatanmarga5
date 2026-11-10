import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import Header from "@/src/components/layout/Header";
import Footer from "@/src/components/layout/Footer";
import SEOHead from "@/src/components/common/SEOHead";
import { 
  Sparkles, 
  MapPin, 
  Layers, 
  SlidersHorizontal, 
  Bell, 
  Check, 
  Plus, 
  ArrowRight, 
  Clock, 
  DownloadCloud, 
  CheckCircle2, 
  ShieldCheck, 
  Flame, 
  BookOpen,
  ChevronRight,
  Crown,
  ShoppingBag,
  GraduationCap,
  Award,
  Network,
  Heart,
  Bookmark,
  User,
  PackageCheck
} from "lucide-react";
import { ReaderPreferencesService } from "@/src/services/readerPreferencesService";
import { SEED_KNOWLEDGE_NODES } from "@/src/services/knowledgeGraphService";
import { StoryEvolutionEngine } from "@/src/services/storyEvolutionEngine";
import { snapshotEngine } from "@/src/services/snapshotEngine";
import type { ReaderPreferences, StorylineArc } from "@/src/types";
import { useAuth } from "@/src/lib/auth";
import { useLanguage } from "@/src/context/LanguageContext";
import { db } from "@/src/lib/firebase";
import { collection, getDocs, query, where } from "@/src/lib/firebase";

const ALL_DISTRICTS_POPULAR = [
  "काठमाडौं", "ललितपुर", "भक्तपुर", "कास्की", "चितवन", 
  "झापा", "मोरङ", "रुपन्देही", "कैलाली", "सुर्खेत", "बाँके", "गोरखा"
];

export default function MySanatanPage() {
  const { user } = useAuth();
  const { language } = useLanguage();
  const [preferences, setPreferences] = useState<ReaderPreferences>(() => ReaderPreferencesService.getPreferences());
  const [activeTab, setActiveTab] = useState<"overview" | "courses" | "orders" | "bookmarks" | "patron">("overview");
  const [articles, setArticles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [storylines, setStorylines] = useState<StorylineArc[]>([]);
  const [orders, setOrders] = useState<any[]>([]);

  useEffect(() => {
    async function loadData() {
      try {
        const snap = await snapshotEngine.getHomepageSnapshot();
        if (snap && snap.latestNews && snap.latestNews.length > 0) {
          setArticles(snap.latestNews);
        }

        // Load local or remote orders
        const storedOrders = localStorage.getItem("sg_commerce_orders");
        if (storedOrders) {
          setOrders(JSON.parse(storedOrders));
        } else if (user) {
          try {
            const q = query(collection(db, "commerce_orders"), where("customerId", "==", user.uid));
            const colSnap = await getDocs(q);
            const userOrders = colSnap.docs.map(d => ({ id: d.id, ...d.data() }));
            setOrders(userOrders);
          } catch (e) {}
        }
      } catch (e) {
        console.warn("Error fetching data for My Sanatan:", e);
      } finally {
        setLoading(false);
      }
    }

    loadData();
    setStorylines(StoryEvolutionEngine.getStorylines());
  }, [user]);

  // Filter personalized articles
  const personalizedArticles = articles.filter(art => {
    if (!preferences) return true;
    const matchDistrict = art.districts?.some((d: string) => preferences.followedDistricts.includes(d)) ||
                          preferences.followedDistricts.includes(art.district);
    const matchCategory = preferences.followedCategories.includes(art.categoryId);
    return matchDistrict || matchCategory;
  });

  const displayArticles = personalizedArticles.length > 0 ? personalizedArticles : articles.slice(0, 8);

  const handleToggleDistrict = (dist: string) => {
    const updated = ReaderPreferencesService.toggleDistrict(dist);
    setPreferences({ ...updated });
  };

  const handleToggleEntity = (id: string) => {
    const updated = ReaderPreferencesService.toggleEntity(id);
    setPreferences({ ...updated });
  };

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      <SEOHead
        title="मेरो सनातन (My Sanatan) - एकीकृत पाठक तथा सदस्य प्रोफाइल"
        description="Your unified profile for reading history, followed districts, courses, orders, and membership status."
        url="/my-sanatan"
      />
      <Header />

      <main className="flex-grow container-custom max-w-6xl py-8 md:py-12 space-y-8">
        
        {/* Profile Card Header */}
        <div className="bg-card border border-border-theme rounded-3xl p-6 md:p-8 shadow-sm space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-border-theme/60 pb-6">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-primary/10 text-primary font-black text-2xl flex items-center justify-center border-2 border-primary/30 shrink-0">
                {user?.photoURL ? (
                  <img src={user.photoURL} alt={user.displayName || "User"} className="w-full h-full rounded-full object-cover" />
                ) : (
                  user?.displayName?.charAt(0) || "S"
                )}
              </div>

              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-xl md:text-2xl font-black text-card-foreground">
                    {user?.displayName || "सनातन मार्ग पाठक (Reader)"}
                  </h1>
                  <span className="px-2.5 py-0.5 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 text-[10px] font-black uppercase tracking-wider border border-amber-500/30 flex items-center gap-1">
                    <Crown size={12} /> सनातन संरक्षक
                  </span>
                </div>
                <p className="text-xs text-muted-text font-medium mt-0.5">
                  {user?.email || "guest@sanatanmarga.com"} • एकीकृत नागरिक तथा ज्ञान प्रोफाइल
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Link
                to="/membership"
                className="px-4 py-2.5 rounded-xl bg-amber-500 text-slate-950 font-black text-xs uppercase tracking-wider hover:bg-amber-400 transition-all shadow-md shadow-amber-500/20 flex items-center gap-1.5"
              >
                <Crown size={14} />
                <span>सदस्यता स्तर बढाउनुहोस्</span>
              </Link>
            </div>
          </div>

          {/* Unified Identity Tabs */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            {[
              { id: "overview", label: "अनुकूलित समाचार फिड", icon: Sparkles },
              { id: "courses", label: "ज्ञान अकाडेमी प्रगति", icon: GraduationCap },
              { id: "orders", label: "सनातन स्टोर खरिदहरू", icon: ShoppingBag },
              { id: "bookmarks", label: "सुरक्षित सामाग्री", icon: Bookmark },
              { id: "patron", label: "संरक्षक योगदान", icon: Heart }
            ].map(tab => {
              const TabIcon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 whitespace-nowrap transition-all cursor-pointer ${
                    activeTab === tab.id
                      ? "bg-primary text-white shadow-sm"
                      : "bg-muted-area text-muted-text hover:text-foreground border border-border-theme"
                  }`}
                >
                  <TabIcon size={14} />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Tab Content: Overview / Personalized Feed */}
        {activeTab === "overview" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-6">
              <div className="flex items-center justify-between border-b border-border-theme pb-3">
                <h3 className="text-base font-black text-card-foreground flex items-center gap-2">
                  <Flame size={18} className="text-amber-500" />
                  <span>तपाईंको रोजाइ अनुसारका समाचारहरू ({displayArticles.length})</span>
                </h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {displayArticles.map(art => (
                  <Link
                    key={art.id}
                    to={`/article/${art.id}`}
                    className="bg-card border border-border-theme rounded-2xl p-4 hover:border-primary/40 transition-all flex flex-col justify-between group shadow-sm space-y-3"
                  >
                    {art.featuredImage && (
                      <img src={art.featuredImage} alt={art.title} className="w-full h-36 rounded-xl object-cover" />
                    )}
                    <div className="space-y-1">
                      <span className="text-[10px] font-bold text-primary uppercase">{art.category || "समाचार"}</span>
                      <h4 className="text-xs md:text-sm font-bold text-card-foreground group-hover:text-primary transition-colors line-clamp-2">
                        {art.title}
                      </h4>
                    </div>
                  </Link>
                ))}
              </div>
            </div>

            {/* Subscriptions Sidebar */}
            <div className="space-y-6">
              <div className="bg-card border border-border-theme rounded-3xl p-5 space-y-4 shadow-sm">
                <h4 className="text-xs font-black uppercase text-card-foreground flex items-center gap-2 border-b border-border-theme pb-3">
                  <MapPin size={16} className="text-primary" /> फलो गरिएका जिल्लाहरू ({preferences.followedDistricts.length})
                </h4>

                <div className="flex flex-wrap gap-1.5">
                  {ALL_DISTRICTS_POPULAR.map(dist => {
                    const isFollowed = preferences.followedDistricts.includes(dist);
                    return (
                      <button
                        key={dist}
                        onClick={() => handleToggleDistrict(dist)}
                        className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                          isFollowed
                            ? "bg-primary text-white shadow-sm"
                            : "bg-muted-area text-muted-text hover:text-foreground border border-border-theme"
                        }`}
                      >
                        {isFollowed ? "✓ " : "+ "}{dist}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab Content: Courses & Progress */}
        {activeTab === "courses" && (
          <div className="bg-card border border-border-theme rounded-3xl p-6 space-y-6 shadow-sm">
            <h3 className="text-base font-black text-card-foreground flex items-center gap-2 border-b border-border-theme pb-4">
              <GraduationCap size={20} className="text-primary" />
              <span>ज्ञान अकाडेमी सिकाइ प्रगति (Academy Progress)</span>
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-muted-area/50 border border-border-theme rounded-2xl p-5 space-y-3">
                <span className="text-[10px] font-black uppercase text-amber-500">अकाडेमी कोर्स</span>
                <h4 className="text-sm font-bold text-card-foreground">श्रीमद्भगवद्गीता परिचय र जीवन दर्शन</h4>
                <div className="space-y-1">
                  <div className="flex justify-between text-xs font-bold text-muted-text">
                    <span>प्रगति: ६६%</span>
                    <span>४/६ पाठ सकियो</span>
                  </div>
                  <div className="h-2 rounded-full bg-border-theme overflow-hidden">
                    <div className="h-full bg-primary w-[66%]" />
                  </div>
                </div>
                <Link to="/academy/course/gita-intro" className="inline-flex items-center gap-1 text-xs font-bold text-primary">
                  <span>कोर्स जारी राख्नुहोस्</span>
                  <ChevronRight size={14} />
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* Tab Content: Orders */}
        {activeTab === "orders" && (
          <div className="bg-card border border-border-theme rounded-3xl p-6 space-y-6 shadow-sm">
            <h3 className="text-base font-black text-card-foreground flex items-center gap-2 border-b border-border-theme pb-4">
              <ShoppingBag size={20} className="text-emerald-500" />
              <span>सनातन स्टोर खरिदहरू ({orders.length})</span>
            </h3>

            {orders.length === 0 ? (
              <div className="text-center py-12 text-xs font-bold text-muted-text space-y-3">
                <p>तपाईंले अहिलेसम्म कुनै अर्डर गर्नुभएको छैन।</p>
                <Link to="/store" className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-white font-bold text-xs">
                  <span>सनातन बजार हेर्नुहोस्</span>
                  <ArrowRight size={14} />
                </Link>
              </div>
            ) : (
              <div className="space-y-4">
                {orders.map((ord, idx) => (
                  <div key={ord.orderId || idx} className="bg-muted-area/50 border border-border-theme rounded-2xl p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div>
                      <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400">अर्डर #: {ord.orderId || `ORD_${idx+1}`}</span>
                      <h4 className="text-xs font-bold text-card-foreground">{ord.productName || "सनातन ग्रन्थ / माला"}</h4>
                      <p className="text-[11px] text-muted-text">मूल्य: रु. {ord.amountNPR || 1250} • ठेगाना: {ord.deliveryAddress || "नेपाल"}</p>
                    </div>
                    <span className="px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-black text-[10px] border border-emerald-500/20">
                      {ord.status || "सम्पर्क गरिएको (WhatsApp)"}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

      </main>

      <Footer />
    </div>
  );
}
