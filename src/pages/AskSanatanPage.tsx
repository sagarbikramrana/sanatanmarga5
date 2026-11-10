import React from "react";
import { Link } from "react-router-dom";
import Header from "@/src/components/layout/Header";
import Footer from "@/src/components/layout/Footer";
import SEOHead from "@/src/components/common/SEOHead";
import { 
  Sparkles, 
  BookOpen, 
  ShieldCheck, 
  Clock,
  ArrowRight,
  Database
} from "lucide-react";
import { useLanguage } from "@/src/context/LanguageContext";

/**
 * SANATANMARGA 5.0 — ASK SANATAN (ROADMAP GATED: PHASE 9)
 * Invariant: Feature Control OFF by default.
 * Zero Gemini provider calls, zero fabricated answers, honest preview state.
 */
export default function AskSanatanPage() {
  const { language } = useLanguage();

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      <SEOHead
        title="सोध्नुहोस् सनातन (Ask Sanatan AI) — रोडम्याप चरण ९"
        description="सनातन एआई अनुसन्धान सहायक (Ask Sanatan AI) हाल विकास क्रममा छ र रोडम्याप चरण ९ का लागि निर्धारित गरिएको छ।"
        url="/ask-sanatan"
      />
      <Header />

      <main className="flex-grow container-custom max-w-4xl py-12 md:py-20 px-4">
        <div className="bg-card border border-border-theme rounded-3xl p-8 md:p-12 text-center shadow-xl space-y-6">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-500 text-xs font-bold uppercase tracking-wider">
            <Clock size={14} />
            <span>रोडम्याप चरण ९ को लागि निर्धारित (Phase 9 Roadmap Scheduled)</span>
          </div>

          <div className="w-20 h-20 mx-auto rounded-3xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-500 shadow-inner">
            <Sparkles size={40} />
          </div>

          <div className="space-y-3 max-w-2xl mx-auto">
            <h1 className="text-3xl md:text-4xl font-black tracking-tight">
              सोध्नुहोस् सनातन एआई (Ask Sanatan)
            </h1>
            <p className="text-muted-text text-base md:text-lg leading-relaxed">
              सनातन एआई अनुसन्धान सहायक हाल प्रारम्भिक विकास तथा अनुसन्धान क्रममा छ। सनातन ज्ञानकोष (Saraswati Knowledge OS), प्राचीन पाण्डुलिपि अभिलेखालय (SGIS), र सभ्यता सञ्जालको प्रामाणिक परीक्षण सम्पन्न भएपछि चरण ९ मा यो सुविधा उपलब्ध गराइनेछ।
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 text-left">
            <div className="p-5 rounded-2xl bg-muted-area/50 border border-border-theme space-y-2">
              <div className="flex items-center gap-2 text-primary font-bold text-sm">
                <Database size={16} />
                <span>प्रामाणिक ज्ञानकोष</span>
              </div>
              <p className="text-xs text-muted-text">
                मनगढन्ते जवाफहरू निषेध। केवल प्रमाणित वैदिक ग्रन्थ र इतिहासमा आधारित।
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-muted-area/50 border border-border-theme space-y-2">
              <div className="flex items-center gap-2 text-primary font-bold text-sm">
                <BookOpen size={16} />
                <span>अभिलेख तथा पाण्डुलिपि</span>
              </div>
              <p className="text-xs text-muted-text">
                नेपालका दुर्लभ हस्तलिखित ग्रन्थ तथा सरकारी प्रमाणहरूसँग सोझो लिङ्क।
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-muted-area/50 border border-border-theme space-y-2">
              <div className="flex items-center gap-2 text-emerald-500 font-bold text-sm">
                <ShieldCheck size={16} />
                <span>शून्य-भ्रम ग्यारेन्टी</span>
              </div>
              <p className="text-xs text-muted-text">
                सम्पादकीय समीक्षा तथा विद्वत् परिषद् द्वारा प्रमाणीकृत एआई अनुसन्धान पाइपलाइन।
              </p>
            </div>
          </div>

          <div className="pt-6 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              to="/knowledge"
              className="w-full sm:w-auto px-6 py-3 rounded-xl bg-primary text-primary-foreground font-bold text-sm flex items-center justify-center gap-2 shadow-lg hover:opacity-90 transition-opacity"
            >
              <BookOpen size={16} />
              <span>ज्ञानकोष अन्वेषण गर्नुहोस् (Explore Knowledge)</span>
            </Link>
            <Link
              to="/archives"
              className="w-full sm:w-auto px-6 py-3 rounded-xl bg-muted-area hover:bg-muted-area/80 border border-border-theme font-bold text-sm flex items-center justify-center gap-2 transition-colors"
            >
              <span>अभिलेखालय हेर्नुहोस्</span>
              <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
