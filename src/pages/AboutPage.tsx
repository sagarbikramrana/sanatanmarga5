import { useState, useEffect } from "react";
import Header from "@/src/components/layout/Header";
import Footer from "@/src/components/layout/Footer";
import { motion, useScroll, useTransform } from "motion/react";
import { Info } from "lucide-react";
import { useTheme } from "@/src/components/StyleProvider";
import { useLanguage } from "@/src/context/LanguageContext";
import SEOHead from "@/src/components/common/SEOHead";

export default function AboutPage() {
  const { scrollY } = useScroll();
  const y1 = useTransform(scrollY, [0, 500], [0, 200]);
  const opacity = useTransform(scrollY, [0, 300], [1, 0]);
  const { siteSettings } = useTheme();
  const { language, t } = useLanguage();
  
  const content = (language === "en" && siteSettings.aboutUs_en) 
    ? siteSettings.aboutUs_en 
    : siteSettings.aboutUs || (language === "en" ? "About information is currently unavailable." : "हाम्रो बारेमा जानकारी उपलब्ध छैन।");

  return (
    <div className="min-h-screen bg-background transition-colors duration-300">
      <SEOHead 
        title={language === "en" ? "About Us" : "हाम्रो बारेमा"} 
        description={content.slice(0, 160)} 
      />
      <Header />
      
      <main className="relative">
        {/* Parallax Hero */}
        <section className="relative h-[60vh] flex items-center justify-center overflow-hidden bg-slate-950">
          <motion.div style={{ y: y1, opacity }} className="absolute inset-0 z-0">
            <div className="absolute inset-0 bg-slate-950/60" />
            <img 
              src="https://images.unsplash.com/photo-1522202176988-66273c2fd55f?q=80&w=2071&auto=format&fit=crop" 
              alt="About Us"
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
            />
          </motion.div>
          
          <motion.div 
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            className="relative z-10 text-center text-white p-6"
          >
            <div className="w-24 h-24 bg-white/10 backdrop-blur-md text-white rounded-3xl flex items-center justify-center mx-auto mb-8 border border-white/20">
              <Info size={48} />
            </div>
            <h1 className="text-5xl md:text-8xl font-black tracking-tighter">
              {language === "en" ? "About Us" : "हाम्रो बारेमा"}
            </h1>
          </motion.div>
        </section>

        {/* Content */}
        <section className="relative z-20 -mt-20 container-custom pb-20">
          <motion.div 
            initial={{ opacity: 0, y: 50 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="max-w-4xl mx-auto bg-card rounded-[3rem] p-10 md:p-20 shadow-2xl shadow-muted-area/50 border border-border-theme"
          >
            <div className="prose-nepali whitespace-pre-wrap text-card-foreground leading-relaxed text-xl font-medium">
              {content}
            </div>
          </motion.div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
