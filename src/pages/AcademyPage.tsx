import React, { useState } from "react";
import { Link } from "react-router-dom";
import Header from "@/src/components/layout/Header";
import Footer from "@/src/components/layout/Footer";
import SEOHead from "@/src/components/common/SEOHead";
import { 
  GraduationCap, 
  BookOpen, 
  Clock, 
  Award, 
  CheckCircle2, 
  Play, 
  ChevronRight, 
  Sparkles, 
  Search, 
  Filter, 
  BookMarked,
  MapPin,
  Users
} from "lucide-react";
import { useLanguage } from "@/src/context/LanguageContext";

export interface Course {
  id: string;
  titleNepali: string;
  titleEnglish: string;
  descriptionNepali: string;
  descriptionEnglish: string;
  instructor: string;
  level: "प्रारम्भिक (Beginner)" | "मध्यम (Intermediate)" | "विशिष्ट (Advanced)";
  duration: string;
  lessonsCount: number;
  category: "scripture" | "history" | "language" | "heritage";
  image: string;
  isPopular?: boolean;
}

export const SAMPLE_COURSES: Course[] = [
  {
    id: "gita-intro",
    titleNepali: "श्रीमद्भगवद्गीता परिचय र जीवन दर्शन",
    titleEnglish: "Introduction to Bhagavad Gita & Life Philosophy",
    descriptionNepali: "भगवद्गीताका ७०० श्लोकहरूको व्यावहारिक सार, कर्मयोग र आधुनिक तनाव व्यवस्थापनमा यसको प्रयोग।",
    descriptionEnglish: "Practical core of Gita's 700 verses, Karma Yoga, and application in modern mind management.",
    instructor: "डा. स्वामी रामानन्द",
    level: "प्रारम्भिक (Beginner)",
    duration: "४ हप्ता (१२ पाठ)",
    lessonsCount: 12,
    category: "scripture",
    image: "https://images.unsplash.com/photo-1609137144813-7d9921338f24?auto=format&fit=crop&w=800&q=80",
    isPopular: true
  },
  {
    id: "vedic-civilization",
    titleNepali: "वैदिक सभ्यता र नेपालको सांस्कृतिक इतिहास",
    titleEnglish: "Vedic Civilization & Cultural History of Nepal",
    descriptionNepali: "हिमाली क्षेत्रमा हुर्केको ऋषि परम्परा, लिच्छवि र मल्ल कालीन वास्तुकला तथा दर्शनको प्रामाणिक खोज।",
    descriptionEnglish: "Rishi tradition in the Himalayas, Licchavi and Malla era architecture, and Vedic philosophy.",
    instructor: "प्रा.डा. दिनेशराज पन्त",
    level: "मध्यम (Intermediate)",
    duration: "६ हप्ता (१८ पाठ)",
    lessonsCount: 18,
    category: "history",
    image: "https://images.unsplash.com/photo-1544717305-2782549b5136?auto=format&fit=crop&w=800&q=80",
    isPopular: true
  },
  {
    id: "sanskrit-basics",
    titleNepali: "संस्कृत भाषा र व्याकरण प्रारम्भिक कोर्स",
    titleEnglish: "Sanskrit Language & Grammar Basics",
    descriptionNepali: "देवनागरी लिपि, सरल संस्कृत सम्भाषण, दैनिक प्रार्थना र स्तोत्रहरूको शुद्ध उच्चारण विधि।",
    descriptionEnglish: "Devanagari script, conversational Sanskrit, and precise pronunciation of Vedic mantras.",
    instructor: "आचार्य विष्णुप्रसाद शर्मा",
    level: "प्रारम्भिक (Beginner)",
    duration: "५ हप्ता (१५ पाठ)",
    lessonsCount: 15,
    category: "language",
    image: "https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?auto=format&fit=crop&w=800&q=80"
  },
  {
    id: "temple-heritage-nepal",
    titleNepali: "नेपालका प्रसिद्ध मन्दिर तथा वास्तुकला",
    titleEnglish: "Famous Temples & Sacred Architecture of Nepal",
    descriptionNepali: "पशुपतिनाथ, मुक्तिनाथ, जानकी मन्दिर तथा ५२ शक्तिपीठहरूको इतिहास, तान्त्रिक विधि र कला।",
    descriptionEnglish: "History, Tantric traditions, and pagoda architecture of Pashupatinath, Muktinath, and Shaktipeeths.",
    instructor: "संस्कृतिविद् सत्यमोहन जोशी स्मृति अध्ययन कक्ष",
    level: "मध्यम (Intermediate)",
    duration: "३ हप्ता (१० पाठ)",
    lessonsCount: 10,
    category: "heritage",
    image: "https://images.unsplash.com/photo-1518002171953-a080ee817e1f?auto=format&fit=crop&w=800&q=80"
  }
];

export default function AcademyPage() {
  const { language } = useLanguage();
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState<string>("");

  const filteredCourses = SAMPLE_COURSES.filter(course => {
    const matchesCategory = selectedCategory === "all" || course.category === selectedCategory;
    const searchCorpus = [course.titleNepali, course.titleEnglish, course.instructor].join(" ").toLowerCase();
    const matchesSearch = searchCorpus.includes(searchTerm.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      <SEOHead
        title={language === "en" ? "Sanatan Academy - Vedic Courses & Learning" : "सनातन ज्ञान अकाडेमी (Sanatan Academy) - वैदिक तथा सांस्कृतिक कोर्सहरू"}
        description="Learn Vedic philosophy, Bhagavad Gita, Sanskrit language, and Nepali cultural heritage with expert-led courses."
        url="/academy"
      />
      <Header />

      <main className="flex-grow container-custom max-w-6xl py-8 md:py-12 space-y-10">
        {/* Header Hero */}
        <div className="border border-border-theme bg-card/60 backdrop-blur-xl rounded-3xl p-6 md:p-10 shadow-sm space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-border-theme pb-6">
            <div className="space-y-2">
              <span className="px-3.5 py-1 rounded-full bg-primary/10 text-primary text-xs font-black uppercase tracking-wider inline-flex items-center gap-1.5">
                <GraduationCap size={14} /> {language === "en" ? "Sanatan Digital Learning Platform" : "सनातन डिजिटल ई-अकाडेमी"}
              </span>
              <h1 className="text-3xl md:text-5xl font-black text-card-foreground tracking-tight">
                {language === "en" ? "Sanatan Learning Academy" : "सनातन ज्ञान अकाडेमी (Academy)"}
              </h1>
              <p className="text-xs md:text-sm text-muted-text font-medium max-w-2xl">
                {language === "en"
                  ? "Explore authentic courses on scriptures, Sanskrit language, Nepalese heritage, and Vedic philosophy. Earn digital certificates of completion."
                  : "प्रामाणिक ग्रन्थ, संस्कृत व्याकरण, नेपालको इतिहास र वैदिक जीवन दर्शनका अनलाइन कोर्सहरूमा सहभागी हुनुहोस्।"}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Link
                to="/training"
                className="px-5 py-3 rounded-2xl bg-amber-500 text-slate-950 text-xs font-black uppercase tracking-wider hover:bg-amber-400 transition-all flex items-center gap-2 shadow-lg shadow-amber-500/20 shrink-0"
              >
                <Award size={16} />
                <span>तालिम तथा प्रमाणीकरण (Training Center)</span>
              </Link>

              <Link
                to="/academy/results"
                className="px-5 py-3 rounded-2xl bg-card border border-border-theme text-foreground text-xs font-black uppercase tracking-wider hover:bg-muted-area transition-all flex items-center gap-2 shadow-sm shrink-0"
              >
                <Award size={16} />
                <span>नतिजा तथा प्रमाणपत्र (My Results)</span>
              </Link>

              <Link
                to="/membership"
                className="px-5 py-3 rounded-2xl bg-primary text-white text-xs font-black uppercase tracking-wider hover:bg-primary/90 transition-all flex items-center gap-2 shadow-lg shadow-primary/20 shrink-0"
              >
                <BookMarked size={16} />
                <span>अकाडेमी पास</span>
              </Link>
            </div>
          </div>

          {/* Search & Filter Bar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="relative flex-1 w-full">
              <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-text" />
              <input
                type="text"
                placeholder="कोर्स वा शिक्षकको नाम खोज्नुहोस्..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-muted-area border border-border-theme rounded-xl text-xs focus:outline-none focus:border-primary"
              />
            </div>

            <div className="flex items-center gap-2 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
              {[
                { id: "all", label: "सबै (All)" },
                { id: "scripture", label: "धर्मशास्त्र" },
                { id: "history", label: "इतिहास" },
                { id: "language", label: "संस्कृत" },
                { id: "heritage", label: "सम्पदा" }
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setSelectedCategory(tab.id)}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                    selectedCategory === tab.id
                      ? "bg-primary text-white shadow-sm"
                      : "bg-muted-area text-muted-text hover:text-foreground border border-border-theme"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Course Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-6">
          {filteredCourses.map(course => (
            <div
              key={course.id}
              className="bg-card border border-border-theme rounded-3xl overflow-hidden hover:border-primary/40 transition-all shadow-sm flex flex-col justify-between group"
            >
              <div className="relative h-48 overflow-hidden bg-muted-area">
                <img
                  src={course.image || "https://images.unsplash.com/photo-1544717305-2782549b5136?auto=format&fit=crop&q=80&w=800"}
                  alt={course.titleNepali}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                
                <div className="absolute top-3 left-3 flex items-center gap-2">
                  <span className="px-2.5 py-1 rounded-lg bg-black/60 backdrop-blur-md text-white text-[10px] font-black uppercase tracking-wider border border-white/20">
                    {course.level}
                  </span>
                  {course.isPopular && (
                    <span className="px-2.5 py-1 rounded-lg bg-amber-500 text-slate-950 text-[10px] font-black uppercase tracking-wider shadow-md">
                      लोकप्रिय
                    </span>
                  )}
                </div>

                <div className="absolute bottom-3 left-3 right-3 text-white space-y-1">
                  <div className="text-[11px] font-bold text-amber-300 flex items-center gap-1">
                    <BookOpen size={12} /> {course.instructor}
                  </div>
                  <h3 className="text-base md:text-lg font-black line-clamp-1">
                    {language === "en" ? course.titleEnglish : course.titleNepali}
                  </h3>
                </div>
              </div>

              <div className="p-6 space-y-4">
                <p className="text-xs text-muted-text leading-relaxed line-clamp-2">
                  {language === "en" ? course.descriptionEnglish : course.descriptionNepali}
                </p>

                <div className="flex items-center justify-between text-[11px] text-muted-text font-bold border-y border-border-theme/60 py-3">
                  <span className="flex items-center gap-1">
                    <Clock size={12} className="text-primary" /> {course.duration}
                  </span>
                  <span className="flex items-center gap-1">
                    <BookMarked size={12} className="text-primary" /> {course.lessonsCount} पाठहरू
                  </span>
                  <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                    <Award size={12} /> प्रमाणपत्र समावेश
                  </span>
                </div>

                <div className="flex items-center justify-between pt-2">
                  <span className="text-xs font-black text-primary">
                    नि:शुल्क / प्रिमियम
                  </span>

                  <Link
                    to={`/academy/course/${course.id}`}
                    className="px-4 py-2.5 rounded-xl bg-primary text-white text-xs font-black uppercase tracking-wider hover:bg-primary/90 transition-all flex items-center gap-1.5 shadow-md shadow-primary/20"
                  >
                    <span>कोर्स हेर्नुहोस्</span>
                    <ChevronRight size={14} />
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      </main>

      <Footer />
    </div>
  );
}
