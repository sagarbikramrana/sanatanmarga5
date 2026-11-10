import React, { useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import Header from "@/src/components/layout/Header";
import Footer from "@/src/components/layout/Footer";
import SEOHead from "@/src/components/common/SEOHead";
import { 
  Play, 
  CheckCircle2, 
  Lock, 
  Clock, 
  Award, 
  BookOpen, 
  ChevronLeft, 
  Sparkles, 
  Download, 
  FileText, 
  Volume2, 
  Share2,
  Check,
  GraduationCap
} from "lucide-react";
import { SAMPLE_COURSES } from "./AcademyPage";
import { useLanguage } from "@/src/context/LanguageContext";
import { useAuth } from "@/src/lib/auth";
import { toast } from "sonner";
import AssessmentPlayer from "@/src/components/academy/AssessmentPlayer";
import AcademyVideoPlayer from "@/src/components/academy/AcademyVideoPlayer";

export default function CourseDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { language } = useLanguage();
  const { user } = useAuth();
  const navigate = useNavigate();

  const course = SAMPLE_COURSES.find(c => c.id === id);
  const [activeLessonIndex, setActiveLessonIndex] = useState<number>(0);
  const [completedLessons, setCompletedLessons] = useState<number[]>([]);
  const [isGeneratingCert, setIsGeneratingCert] = useState<boolean>(false);

  if (!course) {
    return (
      <div className="min-h-screen flex flex-col bg-background text-foreground">
        <SEOHead title="पाठ्यक्रम फेला परेन - सनातन अकाडेमी" description="अनुरोध गरिएको पाठ्यक्रम फेला परेन।" url="/academy" />
        <Header />
        <main className="flex-grow container-custom max-w-4xl py-16 text-center space-y-4">
          <GraduationCap className="w-16 h-16 mx-auto text-muted-text opacity-40" />
          <h1 className="text-2xl font-black">पाठ्यक्रम फेला परेन (Course Not Found)</h1>
          <p className="text-muted-text">तपाईंले खोज्नुभएको पाठ्यक्रम उपलब्ध छैन वा हटाइएको हुन सक्छ।</p>
          <Link to="/academy" className="inline-block px-6 py-2.5 bg-primary text-primary-foreground font-bold rounded-xl mt-4">
            अकाडेमी सूचीमा फर्कनुहोस्
          </Link>
        </main>
        <Footer />
      </div>
    );
  }

  const lessons = [
    { id: 1, title: "पाठ १: प्रवेश, पृष्ठभूमी र मङ्गलाचरण", duration: "१५ मिनेट", type: "video", isFree: true },
    { id: 2, title: "पाठ २: अर्जुनविषादयोग र जीवनको द्वन्द्व", duration: "२० मिनेट", type: "video", isFree: true },
    { id: 3, title: "पाठ ३: साङ्ख्ययोग: आत्माको अमरता र शरीर", duration: "२२ मिनेट", type: "audio", isFree: false },
    { id: 4, title: "पाठ ४: कर्मयोग: फलासक्तिरहित कर्तव्य", duration: "२५ मिनेट", type: "video", isFree: false },
    { id: 5, title: "पाठ ५: ज्ञानकर्मसंन्यासयोग र आधुनिक जीवन", duration: "१८ मिनेट", type: "video", isFree: false },
    { id: 6, title: "पाठ ६: निष्कर्ष, सारसङ्क्षेप र परीक्षा", duration: "३० मिनेट", type: "quiz", isFree: false }
  ];

  const currentLesson = lessons[activeLessonIndex];

  const toggleComplete = (idx: number) => {
    if (completedLessons.includes(idx)) {
      setCompletedLessons(completedLessons.filter(i => i !== idx));
    } else {
      setCompletedLessons([...completedLessons, idx]);
      toast.success("पाठ पूरा भयो!");
    }
  };

  const handleDownloadCertificate = () => {
    if (!user) {
      toast.info("प्रमाणपत्र प्राप्त गर्न कृपया लगइन गर्नुहोस्");
      navigate("/login");
      return;
    }
    setIsGeneratingCert(true);
    setTimeout(() => {
      setIsGeneratingCert(false);
      toast.success("प्रमाणपत्र (PDF) सफलतापुर्वक डाउनलोड भयो!");
    }, 1200);
  };

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      <SEOHead
        title={`${course.titleNepali} - सनातन अकाडेमी`}
        description={course.descriptionNepali}
        url={`/academy/course/${course.id}`}
      />
      <Header />

      <main className="flex-grow container-custom max-w-6xl py-6 md:py-10 space-y-8">
        <Link
          to="/academy"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-muted-text hover:text-primary transition-colors"
        >
          <ChevronLeft size={16} />
          <span>अकाडेमीमा फर्कनुहोस्</span>
        </Link>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Video / Content Area OR Assessment Player */}
          <div className="lg:col-span-2 space-y-6">
            {currentLesson.type === "quiz" ? (
              <AssessmentPlayer courseId={course.id} courseTitle={course.titleNepali} />
            ) : (
              <>
                <AcademyVideoPlayer
                  courseId={course.id}
                  courseTitle={`${course.titleNepali} - ${currentLesson.title}`}
                  courseCategory={course.category}
                  courseVideoUrl=""
                  thumbnailUrl={course.image}
                  userTier={(user as any)?.role === "premium" ? "premium" : (user ? "member" : "free")}
                  onLessonComplete={() => toggleComplete(activeLessonIndex)}
                />

                {/* Lesson Details & Controls */}
                <div className="bg-card border border-border-theme rounded-3xl p-6 space-y-4 shadow-sm">
                  <div className="flex items-center justify-between border-b border-border-theme pb-4">
                    <h2 className="text-xl font-black text-card-foreground">
                      {currentLesson.title}
                    </h2>
                    <button
                      onClick={() => toggleComplete(activeLessonIndex)}
                      className={`px-4 py-2 rounded-xl text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer ${
                        completedLessons.includes(activeLessonIndex)
                          ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30"
                          : "bg-primary text-white hover:bg-primary/90"
                      }`}
                    >
                      <Check size={14} />
                      <span>{completedLessons.includes(activeLessonIndex) ? "पाठ सकियो (Completed)" : "पाठ पूरा गर्नुहोस्"}</span>
                    </button>
                  </div>

                  <p className="text-xs text-muted-text leading-relaxed">
                    {course.descriptionNepali}
                  </p>

                  {/* Course Progress Bar */}
                  <div className="space-y-2 pt-2">
                    <div className="flex justify-between text-xs font-bold text-muted-text">
                      <span>प्रगति (Progress): {Math.round((completedLessons.length / lessons.length) * 100)}%</span>
                      <span>{completedLessons.length}/{lessons.length} पाठ सकियो</span>
                    </div>
                    <div className="h-2 rounded-full bg-muted-area overflow-hidden">
                      <div
                        className="h-full bg-primary transition-all duration-500"
                        style={{ width: `${(completedLessons.length / lessons.length) * 100}%` }}
                      />
                    </div>
                  </div>

                  {completedLessons.length === lessons.length && (
                    <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-card-foreground flex flex-col sm:flex-row items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <Award size={28} className="text-amber-500 shrink-0" />
                        <div>
                          <div className="text-xs font-black">बधाई छ! तपाईंले यो कोर्स पुरा गर्नुभयो!</div>
                          <div className="text-[11px] text-muted-text">सनातन ज्ञान अकाडेमीको आधिकारिक प्रमाणपत्र डाउनलोड गर्नुहोस्।</div>
                        </div>
                      </div>
                      <button
                        onClick={handleDownloadCertificate}
                        disabled={isGeneratingCert}
                        className="px-4 py-2.5 rounded-xl bg-amber-500 text-slate-950 font-black text-xs uppercase tracking-wider flex items-center gap-1.5 hover:bg-amber-400 transition-all shrink-0 cursor-pointer"
                      >
                        <Download size={14} />
                        <span>{isGeneratingCert ? "तयार हुँदैछ..." : "प्रमाणपत्र (PDF)"}</span>
                      </button>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>

          {/* Lessons Syllabus Sidebar */}
          <div className="space-y-4">
            <div className="bg-card border border-border-theme rounded-3xl p-5 space-y-4 shadow-sm">
              <h3 className="text-sm font-black text-card-foreground flex items-center gap-2 border-b border-border-theme pb-3">
                <BookOpen size={16} className="text-primary" />
                <span>पाठ्यक्रम तालिका (Syllabus)</span>
              </h3>

              <div className="space-y-2">
                {lessons.map((lesson, idx) => {
                  const isActive = idx === activeLessonIndex;
                  const isCompleted = completedLessons.includes(idx);

                  return (
                    <button
                      key={lesson.id}
                      onClick={() => setActiveLessonIndex(idx)}
                      className={`w-full p-3 rounded-2xl text-left border transition-all flex items-center justify-between gap-3 cursor-pointer ${
                        isActive
                          ? "bg-primary/10 border-primary text-primary shadow-sm"
                          : "bg-muted-area/50 border-border-theme hover:bg-muted-area text-card-foreground"
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        {isCompleted ? (
                          <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />
                        ) : (
                          <span className="w-5 h-5 rounded-full bg-slate-500/20 text-muted-text text-[10px] font-bold flex items-center justify-center shrink-0">
                            {idx + 1}
                          </span>
                        )}
                        <div className="truncate text-xs font-bold">
                          {lesson.title}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[10px] text-muted-text font-medium">{lesson.duration}</span>
                        {!lesson.isFree && !user && <Lock size={12} className="text-muted-text" />}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
