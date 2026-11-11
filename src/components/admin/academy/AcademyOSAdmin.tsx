import React, { useState, useEffect } from "react";
import { 
  GraduationCap, Plus, Search, Edit3, Trash2, BookOpen, 
  Clock, Award, FileText, Music, Video, Sparkles, X, Save, CheckCircle2, HelpCircle
} from "lucide-react";
import AssessmentOSAdmin from "./AssessmentOSAdmin";
import AcademyVideoAdsAdmin from "./AcademyVideoAdsAdmin";
import { db, safeOnSnapshot, handleFirestoreError, OperationType } from "@/src/lib/firebase";
import { collection, doc, setDoc, deleteDoc } from "@/src/lib/firebase";
import { SAMPLE_COURSES, Course, GURUKUL_SCHOOLS, ACHARYA_FACULTY } from "@/src/pages/AcademyPage";
import { toast } from "sonner";
import { motion, AnimatePresence } from "motion/react";

export default function AcademyOSAdmin() {
  const [courses, setCourses] = useState<Course[]>(SAMPLE_COURSES);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedTab, setSelectedTab] = useState<"courses" | "schools" | "acharyas" | "admissions" | "lessons" | "materials" | "audio" | "certificates" | "assessment" | "video_ads">("courses");
  const [acharyas, setAcharyas] = useState(ACHARYA_FACULTY);
  const [newAcharyaName, setNewAcharyaName] = useState("");
  const [newAcharyaTitle, setNewAcharyaTitle] = useState("");
  const [scholarshipApps, setScholarshipApps] = useState([
    { id: "sch-1", student: "सुमन उपाध्याय (कास्की)", school: "वैदिक तथा उपनिषद् विद्यापीठ", attendance: "94%", status: "Approved (मेधावी छात्रवृत्ति)" },
    { id: "sch-2", student: "प्रतीक्षा पन्त (कैलाली)", school: "संस्कृत भाषा तथा प्राचीन लिपि विद्यापीठ", attendance: "89%", status: "Pending Review" },
    { id: "sch-3", student: "रोशन अधिकारी (मोरङ)", school: "धर्म, नीति र नागरिक नेतृत्व विद्यापीठ", attendance: "92%", status: "Approved (पूर्ण शुल्क मिनाहा)" }
  ]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCourseId, setEditingCourseId] = useState<string | null>(null);

  const [courseForm, setCourseForm] = useState({
    titleNepali: "",
    titleEnglish: "",
    descriptionNepali: "",
    descriptionEnglish: "",
    instructor: "",
    level: "प्रारम्भिक (Beginner)" as "प्रारम्भिक (Beginner)" | "मध्यम (Intermediate)" | "विशिष्ट (Advanced)",
    duration: "४ हप्ता (१२ पाठ)",
    lessonsCount: 12,
    category: "scripture" as "scripture" | "history" | "language" | "heritage",
    image: "",
    isPopular: false
  });

  useEffect(() => {
    let isMounted = true;
    let seededOnce = false;

    const unsub = safeOnSnapshot(
      collection(db, "academy_courses"),
      async (snap) => {
        if (!isMounted) return;
        if (snap.empty && !seededOnce) {
          seededOnce = true;
          for (const item of SAMPLE_COURSES) {
            try {
              await setDoc(doc(db, "academy_courses", item.id), item, { merge: true });
            } catch (e) {}
          }
          return;
        }
        if (!snap.empty) {
          setCourses(snap.docs.map(d => ({ id: d.id, ...d.data() } as Course)));
        }
      },
      "admin_academy_listener"
    );

    return () => {
      isMounted = false;
      if (typeof unsub === "function") unsub();
    };
  }, []);

  const handleOpenCreateCourse = () => {
    setEditingCourseId(null);
    setCourseForm({
      titleNepali: "",
      titleEnglish: "",
      descriptionNepali: "",
      descriptionEnglish: "",
      instructor: "आचार्य / प्राध्यापक",
      level: "प्रारम्भिक (Beginner)",
      duration: "४ हप्ता (१२ पाठ)",
      lessonsCount: 12,
      category: "scripture",
      image: "https://images.unsplash.com/photo-1609137144813-7d9921338f24?auto=format&fit=crop&w=800&q=80",
      isPopular: false
    });
    setIsModalOpen(true);
  };

  const handleOpenEditCourse = (course: Course) => {
    setEditingCourseId(course.id);
    setCourseForm({
      titleNepali: course.titleNepali || "",
      titleEnglish: course.titleEnglish || "",
      descriptionNepali: course.descriptionNepali || "",
      descriptionEnglish: course.descriptionEnglish || "",
      instructor: course.instructor || "",
      level: course.level || "प्रारम्भिक (Beginner)",
      duration: course.duration || "",
      lessonsCount: course.lessonsCount || 10,
      category: course.category || "scripture",
      image: course.image || "",
      isPopular: !!course.isPopular
    });
    setIsModalOpen(true);
  };

  const handleSaveCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!courseForm.titleNepali || !courseForm.instructor) {
      toast.error("कृपया कोर्सको नाम र प्रशिक्षक भर्नुहोस्");
      return;
    }

    const docId = editingCourseId || `course-${Date.now()}`;
    const payload: Course = {
      id: docId,
      titleNepali: courseForm.titleNepali.trim(),
      titleEnglish: courseForm.titleEnglish.trim() || courseForm.titleNepali.trim(),
      descriptionNepali: courseForm.descriptionNepali.trim(),
      descriptionEnglish: courseForm.descriptionEnglish.trim() || courseForm.descriptionNepali.trim(),
      instructor: courseForm.instructor.trim(),
      level: courseForm.level,
      duration: courseForm.duration.trim(),
      lessonsCount: Number(courseForm.lessonsCount) || 1,
      category: courseForm.category,
      image: courseForm.image.trim() || "https://images.unsplash.com/photo-1609137144813-7d9921338f24?auto=format&fit=crop&w=800&q=80",
      isPopular: courseForm.isPopular
    };

    try {
      await fetch("/api/courses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: docId, ...payload }),
      }).catch(() => {});
      await setDoc(doc(db, "academy_courses", docId), payload, { merge: true });
      setCourses(prev => {
        const exists = prev.some(c => c.id === docId);
        const next = exists ? prev.map(c => c.id === docId ? payload : c) : [payload, ...prev];
        try {
          localStorage.setItem("sanatan_academy_courses", JSON.stringify(next));
        } catch {}
        return next;
      });
      toast.success(editingCourseId ? "कोर्स अद्यावधिक भयो!" : "नयाँ कोर्स सुरक्षित भयो!");
      setIsModalOpen(false);
    } catch (err: any) {
      handleFirestoreError(err, editingCourseId ? OperationType.UPDATE : OperationType.CREATE, `academy_courses/${docId}`);
      toast.error("सेभ गर्न असफल");
    }
  };

  const handleDeleteCourse = async (id: string) => {
    if (!confirm("के तपाईं यो कोर्स हटाउन निश्चित हुनुहुन्छ?")) return;
    try {
      await fetch(`/api/courses/${id}`, { method: "DELETE" });
      await deleteDoc(doc(db, "academy_courses", id));
      toast.success("कोर्स हटाइयो!");
    } catch (err: any) {
      handleFirestoreError(err, OperationType.DELETE, `academy_courses/${id}`);
      toast.error("हटाउन असफल");
    }
  };

  const filtered = courses.filter(c => {
    const s = searchTerm.toLowerCase();
    return (c.titleNepali || "").toLowerCase().includes(s) ||
           (c.titleEnglish || "").toLowerCase().includes(s) ||
           (c.instructor || "").toLowerCase().includes(s);
  });

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-card p-6 rounded-3xl border border-border-theme shadow-sm">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-black uppercase tracking-wider mb-2 border border-emerald-500/20">
            <GraduationCap size={14} /> AcademyOS Admin • सनातन डिजिटल अकाडेमी
          </div>
          <h2 className="text-xl md:text-2xl font-black text-card-foreground">
            ई-अकाडेमी तथा पाठ्यक्रम व्यवस्थापक
          </h2>
          <p className="text-xs md:text-sm text-muted-text">
            कोर्सहरू, पाठहरू, अध्ययन सामग्रीहरू (PDFs), अडियो तथा डिजिटल प्रमाणपत्रहरू प्रबन्ध गर्नुहोस्।
          </p>
        </div>

        <button
          onClick={handleOpenCreateCourse}
          className="px-5 py-2.5 rounded-2xl bg-primary text-white text-xs font-black flex items-center gap-2 shadow-md hover:bg-primary/90 transition-all cursor-pointer shrink-0"
        >
          <Plus size={16} />
          <span>नयाँ कोर्स थप्नुहोस्</span>
        </button>
      </div>

      {/* Internal Sub Tabs */}
      <div className="flex items-center gap-2 border-b border-border-theme pb-3 overflow-x-auto">
        {[
          { id: "courses", label: "कोर्सहरू (Courses)", icon: BookOpen },
          { id: "schools", label: "विद्यापीठहरू (Gurukul Schools)", icon: GraduationCap },
          { id: "acharyas", label: "आचार्य व्यवस्थापन (Acharyas)", icon: Award },
          { id: "admissions", label: "छात्रवृत्ति र हाजिरी (Admissions & Attendance)", icon: CheckCircle2 },
          { id: "lessons", label: "पाठहरू (Lessons)", icon: Video },
          { id: "video_ads", label: "भिडियो विज्ञापन OS (Video Ads)", icon: Sparkles },
          { id: "materials", label: "PDFs & अध्ययन सामग्री", icon: FileText },
          { id: "audio", label: "अडियो तथा मन्त्रोच्चारण", icon: Music },
          { id: "certificates", label: "प्रमाणपत्र कन्फिगरेसन", icon: Award },
          { id: "assessment", label: "परीक्षा तथा AssessmentOS", icon: HelpCircle }
        ].map(t => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => setSelectedTab(t.id as any)}
              className={`flex items-center gap-2 px-4 py-2 rounded-2xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                selectedTab === t.id
                  ? "bg-primary text-white shadow-sm"
                  : "bg-muted-area text-muted-text hover:text-foreground border border-border-theme"
              }`}
            >
              <Icon size={14} />
              <span>{t.label}</span>
            </button>
          );
        })}
      </div>

      {selectedTab === "courses" && (
        <div className="space-y-4">
          <div className="relative w-full">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-text" />
            <input
              type="text"
              placeholder="कोर्सको नाम वा प्रशिक्षक खोज्नुहोस्..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-card border border-border-theme rounded-2xl text-xs font-medium focus:outline-none focus:border-primary"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {filtered.map(course => (
              <div
                key={course.id}
                className="bg-card border border-border-theme rounded-3xl p-5 hover:border-primary/40 transition-all shadow-sm space-y-4 flex flex-col justify-between"
              >
                <div className="flex gap-4">
                  <img
                    src={course.image}
                    alt={course.titleNepali}
                    className="w-24 h-24 rounded-2xl object-cover shrink-0 border border-border-theme"
                  />
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded bg-primary/10 text-primary text-[10px] font-black uppercase">
                        {course.level}
                      </span>
                      {course.isPopular && (
                        <span className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-500 text-[10px] font-bold">
                          लोकप्रिय
                        </span>
                      )}
                    </div>
                    <h3 className="text-base font-black text-card-foreground leading-snug">
                      {course.titleNepali}
                    </h3>
                    <p className="text-[11px] text-muted-text">{course.instructor}</p>
                  </div>
                </div>

                <p className="text-xs text-muted-text line-clamp-2">
                  {course.descriptionNepali}
                </p>

                <div className="flex items-center justify-between pt-3 border-t border-border-theme/60 text-xs">
                  <div className="flex items-center gap-3 text-muted-text font-medium text-[11px]">
                    <span className="flex items-center gap-1"><Clock size={12} /> {course.duration}</span>
                    <span className="flex items-center gap-1"><BookOpen size={12} /> {course.lessonsCount} पाठ</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleOpenEditCourse(course)}
                      className="p-2 hover:bg-primary/10 text-primary rounded-xl transition-colors cursor-pointer"
                      title="सम्पादन गर्नुहोस्"
                    >
                      <Edit3 size={15} />
                    </button>
                    <button
                      onClick={() => handleDeleteCourse(course.id)}
                      className="p-2 hover:bg-red-500/10 text-red-500 rounded-xl transition-colors cursor-pointer"
                      title="हटाउनुहोस्"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {selectedTab === "schools" && (
        <div className="bg-card p-6 rounded-3xl border border-border-theme space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-base font-bold text-card-foreground">अनलाइन गुरुकुल विद्यापीठहरू (Gurukul Academic Schools)</h3>
            <span className="text-xs font-bold text-emerald-500">{GURUKUL_SCHOOLS.length} Active Schools</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {GURUKUL_SCHOOLS.map((sch) => (
              <div key={sch.id} className="p-5 rounded-2xl border border-border-theme bg-muted-area/30 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-amber-500">{sch.nameEn}</span>
                  <span className="px-2.5 py-0.5 rounded-full bg-primary/10 text-primary text-[11px] font-bold">{sch.studentsCount} विद्यार्थी</span>
                </div>
                <div className="text-base font-black text-card-foreground">{sch.nameNe}</div>
                <div className="text-xs text-muted-text">प्रमुख आचार्य (Dean): <strong className="text-card-foreground">{sch.dean}</strong> • {sch.coursesCount} कोर्सहरू</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {selectedTab === "acharyas" && (
        <div className="bg-card p-6 rounded-3xl border border-border-theme space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-base font-bold text-card-foreground">आचार्य तथा प्राध्यापक निर्देशिका (Acharya & Instructor Management)</h3>
            <div className="flex flex-wrap gap-2">
              <input
                type="text"
                value={newAcharyaName}
                onChange={(e) => setNewAcharyaName(e.target.value)}
                placeholder="नयाँ आचार्यको नाम..."
                className="px-3 py-1.5 rounded-xl border border-border-theme bg-muted-area text-xs"
              />
              <input
                type="text"
                value={newAcharyaTitle}
                onChange={(e) => setNewAcharyaTitle(e.target.value)}
                placeholder="उपाधि र विशेषज्ञता..."
                className="px-3 py-1.5 rounded-xl border border-border-theme bg-muted-area text-xs"
              />
              <button
                type="button"
                onClick={async () => {
                  if (!newAcharyaName.trim()) return;
                  const newAch = {
                    id: `ach-${Date.now()}`,
                    nameNe: newAcharyaName.trim(),
                    nameEn: newAcharyaName.trim(),
                    titleNe: newAcharyaTitle.trim() || "गुरुकुल प्राध्यापक",
                    school: "वैदिक दर्शन विद्यापीठ",
                    experience: "१५+ वर्ष",
                    coursesCount: 2,
                    verified: true
                  };
                  const next = [...acharyas, newAch];
                  setAcharyas(next);
                  try {
                    localStorage.setItem("sanatan_academy_acharyas", JSON.stringify(next));
                    if (db) await setDoc(doc(db, "academy_acharyas", newAch.id), newAch, { merge: true });
                  } catch {}
                  setNewAcharyaName("");
                  setNewAcharyaTitle("");
                  toast.success("नयाँ आचार्य गुरुकुल निर्देशिकामा थपियो र सिंक भयो!");
                }}
                className="px-4 py-1.5 rounded-xl bg-primary text-white text-xs font-bold flex items-center gap-1"
              >
                <Plus size={14} /> आचार्य थप्नुहोस्
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {acharyas.map((a) => (
              <div key={a.id} className="p-4 rounded-2xl border border-border-theme bg-muted-area/30 flex items-center justify-between">
                <div className="space-y-1">
                  <div className="text-sm font-black text-card-foreground flex items-center gap-1.5">
                    <span>{a.nameNe}</span>
                    <CheckCircle2 size={14} className="text-emerald-500" />
                  </div>
                  <div className="text-xs text-amber-500 font-semibold">{a.titleNe}</div>
                  <div className="text-[11px] text-muted-text">{a.school} • अनुभव: {a.experience}</div>
                </div>
                <span className="px-2.5 py-1 rounded-xl bg-emerald-500/10 text-emerald-500 text-[11px] font-bold">
                  {a.coursesCount} कोर्स
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {selectedTab === "admissions" && (
        <div className="bg-card p-6 rounded-3xl border border-border-theme space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-card-foreground">छात्रवृत्ति, भर्ना र हाजिरी व्यवस्थापन (Scholarships, Admissions & Attendance)</h3>
            <span className="text-xs font-bold text-amber-500">न्यूनतम हाजिरी मापदण्ड: ८०% अनिवार्य</span>
          </div>
          <div className="divide-y divide-border-theme/60 text-xs">
            {scholarshipApps.map((app) => (
              <div key={app.id} className="py-3.5 flex flex-wrap items-center justify-between gap-4">
                <div className="space-y-0.5">
                  <div className="font-bold text-card-foreground text-sm">{app.student}</div>
                  <div className="text-muted-text">{app.school} • हाजिरी (Attendance): <strong className="text-emerald-500">{app.attendance}</strong></div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-500 font-bold text-[11px]">
                    {app.status}
                  </span>
                  {app.status === "Pending Review" && (
                    <button
                      type="button"
                      onClick={() => {
                        setScholarshipApps(prev => prev.map(item => item.id === app.id ? { ...item, status: "Approved (छात्रवृत्ति स्वीकृत)" } : item));
                        toast.success("छात्रवृत्ति आवेदन स्वीकृत गरियो!");
                      }}
                      className="px-3 py-1 rounded-xl bg-primary text-white font-bold text-[11px]"
                    >
                      स्वीकृत गर्नुहोस् (Approve)
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {selectedTab === "lessons" && (
        <div className="bg-card p-6 rounded-3xl border border-border-theme space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-base font-bold text-card-foreground">पाठ्यक्रमका भिडियो तथा अडियो पाठहरू</h3>
            <button
              onClick={() => toast.success("नयाँ पाठ थप्ने फारम तयार भयो!")}
              className="px-4 py-2 bg-primary text-white rounded-xl text-xs font-bold flex items-center gap-1.5"
            >
              <Plus size={14} /> नयाँ पाठ थप्नुहोस्
            </button>
          </div>
          <div className="divide-y divide-border-theme/60 text-xs">
            {[
              { id: "1", title: "पाठ १: गीताको ऐतिहासिक पृष्ठभूमि र कुरुक्षेत्र युद्ध", duration: "२५ मिनेट", course: "श्रीमद्भगवद्गीता परिचय" },
              { id: "2", title: "पाठ २: सांख्य योग र आत्मज्ञानको शाश्वत स्वरूप", duration: "३५ मिनेट", course: "श्रीमद्भगवद्गीता परिचय" },
              { id: "3", title: "पाठ ३: कर्मयोग - अनासक्त कर्मको रहस्य", duration: "४० मिनेट", course: "श्रीमद्भगवद्गीता परिचय" },
              { id: "4", title: "पाठ १: देवनागरी वर्णमाला र उच्चारण स्थान", duration: "३० मिनेट", course: "संस्कृत भाषा र व्याकरण" }
            ].map(l => (
              <div key={l.id} className="py-3 flex items-center justify-between hover:bg-muted-area/30 px-2 rounded-xl">
                <div className="space-y-0.5">
                  <div className="font-bold text-card-foreground">{l.title}</div>
                  <div className="text-muted-text text-[11px] flex items-center gap-2">
                    <span>{l.course}</span> • <span className="flex items-center gap-1"><Clock size={10} /> {l.duration}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button className="p-1.5 hover:bg-primary/10 text-primary rounded-lg"><Edit3 size={14} /></button>
                  <button className="p-1.5 hover:bg-red-500/10 text-red-500 rounded-lg"><Trash2 size={14} /></button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {selectedTab === "materials" && (
        <div className="bg-card p-6 rounded-3xl border border-border-theme space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-base font-bold text-card-foreground">डिजिटल अध्ययन सामग्री तथा PDFs (Study Notes & Guides)</h3>
            <button
              onClick={() => toast.success("PDF अपलोड विन्डो खुल्यो!")}
              className="px-4 py-2 bg-primary text-white rounded-xl text-xs font-bold flex items-center gap-1.5"
            >
              <Plus size={14} /> PDF / ई-बुक अपलोड गर्नुहोस्
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {[
              { title: "श्रीमद्भगवद्गीता पदच्छेद र अन्वय", size: "४.२ MB", downloads: 1240 },
              { title: "संस्कृत व्याकरण सार संग्रह", size: "२.८ MB", downloads: 890 },
              { title: "वैदिक सभ्यता र लिच्छवि अभिलेख नोट्स", size: "६.१ MB", downloads: 650 }
            ].map((m, i) => (
              <div key={i} className="p-4 bg-muted-area/40 border border-border-theme rounded-2xl space-y-2">
                <div className="flex items-center gap-2 text-primary font-bold text-xs">
                  <FileText size={16} /> PDF सामग्री
                </div>
                <div className="font-bold text-card-foreground text-xs">{m.title}</div>
                <div className="text-[10px] text-muted-text flex justify-between pt-2 border-t border-border-theme">
                  <span>साइज: {m.size}</span>
                  <span>{m.downloads} डाउनलोड</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {selectedTab === "audio" && (
        <div className="bg-card p-6 rounded-3xl border border-border-theme space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-base font-bold text-card-foreground">अडियो फाइल तथा वैदिक मन्त्रोच्चारण (Audio Lectures)</h3>
            <button
              onClick={() => toast.success("अडियो फाइल जोड्ने फारम सक्रिय भयो!")}
              className="px-4 py-2 bg-primary text-white rounded-xl text-xs font-bold flex items-center gap-1.5"
            >
              <Plus size={14} /> अडियो ट्र्याक थप्नुहोस्
            </button>
          </div>
          <div className="divide-y divide-border-theme/60 text-xs">
            {[
              { title: "ऋग्वेद शान्तिमन्त्र र पुरुषसूक्त गायन", speaker: "आचार्य महेशप्रसाद शास्त्री", duration: "१८:४०" },
              { title: "गीता द्वितीय अध्याय श्लोक उच्चारण अभ्यास", speaker: "डा. स्वामी रामानन्द", duration: "२८:१५" },
              { title: "रुद्राष्टाध्यायी एवं शिवस्तुति", speaker: "पशुपतिनाथ मन्दिर वेदपाठक दल", duration: "३२:००" }
            ].map((a, i) => (
              <div key={i} className="py-3 flex items-center justify-between hover:bg-muted-area/30 px-2 rounded-xl">
                <div className="space-y-0.5">
                  <div className="font-bold text-card-foreground flex items-center gap-2">
                    <Music size={14} className="text-amber-500" /> {a.title}
                  </div>
                  <div className="text-muted-text text-[11px]">{a.speaker} • {a.duration}</div>
                </div>
                <div className="flex items-center gap-2">
                  <button className="p-1.5 hover:bg-primary/10 text-primary rounded-lg"><Edit3 size={14} /></button>
                  <button className="p-1.5 hover:bg-red-500/10 text-red-500 rounded-lg"><Trash2 size={14} /></button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {selectedTab === "certificates" && (
        <div className="bg-card p-6 rounded-3xl border border-border-theme space-y-6">
          <div className="space-y-1">
            <h3 className="text-base font-bold text-card-foreground flex items-center gap-2">
              <Award size={18} className="text-amber-500" />
              <span>डिजिटल प्रमाणपत्र व्यवस्थापन (Certificate Verification Engine)</span>
            </h3>
            <p className="text-xs text-muted-text">
              कोर्स उत्तीर्ण गर्ने विद्यार्थीहरूका लागि स्वचालित डिजिटल प्रमाणपत्र र QR कोड प्रमाणीकरण।
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
            <div className="p-5 bg-muted-area/40 rounded-2xl border border-border-theme space-y-4">
              <h4 className="font-bold text-card-foreground">प्रमाणपत्र मापदण्ड (Passing Criteria)</h4>
              <div className="space-y-3">
                <div>
                  <label className="block text-muted-text mb-1">न्यूनतम उत्तीर्ण अङ्क (%):</label>
                  <input type="number" defaultValue={70} className="w-full bg-card border border-border-theme rounded-xl px-3 py-2 text-xs" />
                </div>
                <div>
                  <label className="block text-muted-text mb-1">प्रमाणपत्र जारीकर्ता हस्ताक्षरकर्ता:</label>
                  <input type="text" defaultValue="सनातन ज्ञान अकाडेमी निर्देशक" className="w-full bg-card border border-border-theme rounded-xl px-3 py-2 text-xs" />
                </div>
                <button
                  onClick={() => toast.success("प्रमाणपत्र मापदण्ड सुरक्षित भयो!")}
                  className="px-4 py-2 bg-primary text-white rounded-xl font-bold"
                >
                  सेभ गर्नुहोस्
                </button>
              </div>
            </div>

            <div className="p-5 bg-muted-area/40 rounded-2xl border border-border-theme flex flex-col justify-between">
              <div className="space-y-2">
                <h4 className="font-bold text-card-foreground">प्रमाणपत्र प्रिभ्यू</h4>
                <div className="p-4 bg-card border border-amber-500/30 rounded-xl text-center space-y-2">
                  <Award size={28} className="mx-auto text-amber-500" />
                  <div className="font-black text-xs">SANATAN ACADEMY OF VEDIC STUDIES</div>
                  <div className="text-[10px] text-muted-text">Certificate of Authentic Completion</div>
                  <div className="text-[9px] text-muted-text font-mono">Verification Hash: #SM-ACAD-8842</div>
                </div>
              </div>
              <button
                onClick={() => toast.success("नयाँ टेम्प्लेट अपलोड भयो!")}
                className="mt-4 px-4 py-2 bg-muted-area hover:bg-muted-area/80 border border-border-theme rounded-xl font-bold text-xs"
              >
                नयाँ टेम्प्लेट परिवर्तन गर्नुहोस्
              </button>
            </div>
          </div>
        </div>
      )}

      {selectedTab === "assessment" && <AssessmentOSAdmin />}
      {selectedTab === "video_ads" && <AcademyVideoAdsAdmin />}

      {/* Modal for Edit / Create Course */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-card text-card-foreground border border-border-theme rounded-3xl max-w-2xl w-full p-6 shadow-2xl overflow-y-auto max-h-[90vh] custom-scrollbar"
            >
              <div className="flex items-center justify-between pb-4 border-b border-border-theme">
                <h3 className="text-base font-black flex items-center gap-2">
                  <GraduationCap size={18} className="text-emerald-500" />
                  {editingCourseId ? "कोर्स सम्पादन" : "नयाँ कोर्स सिर्जना गर्नुहोस् (New Academy Course)"}
                </h3>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="p-1 rounded-xl text-muted-text hover:text-foreground hover:bg-muted-area"
                >
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleSaveCourse} className="space-y-4 mt-4 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block font-bold text-muted-text mb-1">नेपाली कोर्स शीर्षक *</label>
                    <input
                      type="text"
                      required
                      value={courseForm.titleNepali}
                      onChange={e => setCourseForm(p => ({ ...p, titleNepali: e.target.value }))}
                      placeholder="उदा: श्रीमद्भगवद्गीता परिचय"
                      className="w-full bg-muted-area border border-border-theme rounded-xl px-3 py-2 text-xs"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-muted-text mb-1">English Course Title</label>
                    <input
                      type="text"
                      value={courseForm.titleEnglish}
                      onChange={e => setCourseForm(p => ({ ...p, titleEnglish: e.target.value }))}
                      placeholder="e.g. Introduction to Bhagavad Gita"
                      className="w-full bg-muted-area border border-border-theme rounded-xl px-3 py-2 text-xs"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block font-bold text-muted-text mb-1">प्रशिक्षक / आचार्य *</label>
                    <input
                      type="text"
                      required
                      value={courseForm.instructor}
                      onChange={e => setCourseForm(p => ({ ...p, instructor: e.target.value }))}
                      placeholder="उदा: डा. स्वामी रामानन्द"
                      className="w-full bg-muted-area border border-border-theme rounded-xl px-3 py-2 text-xs"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-muted-text mb-1">तह (Level)</label>
                    <select
                      value={courseForm.level}
                      onChange={e => setCourseForm(p => ({ ...p, level: e.target.value as any }))}
                      className="w-full bg-muted-area border border-border-theme rounded-xl px-3 py-2 text-xs"
                    >
                      <option value="प्रारम्भिक (Beginner)">प्रारम्भिक (Beginner)</option>
                      <option value="मध्यम (Intermediate)">मध्यम (Intermediate)</option>
                      <option value="विशिष्ट (Advanced)">विशिष्ट (Advanced)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block font-bold text-muted-text mb-1">विधा (Category)</label>
                    <select
                      value={courseForm.category}
                      onChange={e => setCourseForm(p => ({ ...p, category: e.target.value as any }))}
                      className="w-full bg-muted-area border border-border-theme rounded-xl px-3 py-2 text-xs"
                    >
                      <option value="scripture">धर्मशास्त्र (Scripture)</option>
                      <option value="history">इतिहास (History)</option>
                      <option value="language">संस्कृत भाषा (Language)</option>
                      <option value="heritage">सम्पदा (Heritage)</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-muted-text mb-1">अवधि (Duration Text)</label>
                    <input
                      type="text"
                      value={courseForm.duration}
                      onChange={e => setCourseForm(p => ({ ...p, duration: e.target.value }))}
                      placeholder="उदा: ४ हप्ता (१२ पाठ)"
                      className="w-full bg-muted-area border border-border-theme rounded-xl px-3 py-2 text-xs"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-muted-text mb-1">पाठ संख्या (Lessons Count)</label>
                    <input
                      type="number"
                      value={courseForm.lessonsCount}
                      onChange={e => setCourseForm(p => ({ ...p, lessonsCount: parseInt(e.target.value) || 1 }))}
                      className="w-full bg-muted-area border border-border-theme rounded-xl px-3 py-2 text-xs"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-muted-text mb-1">नेपाली विवरण *</label>
                  <textarea
                    rows={3}
                    required
                    value={courseForm.descriptionNepali}
                    onChange={e => setCourseForm(p => ({ ...p, descriptionNepali: e.target.value }))}
                    placeholder="कोर्सको परिचय र सिकाइ उद्देश्य..."
                    className="w-full bg-muted-area border border-border-theme rounded-xl px-3 py-2 text-xs"
                  />
                </div>

                <div>
                  <label className="block font-bold text-muted-text mb-1">कभर तस्बिर URL</label>
                  <input
                    type="text"
                    value={courseForm.image}
                    onChange={e => setCourseForm(p => ({ ...p, image: e.target.value }))}
                    placeholder="https://images.unsplash.com/..."
                    className="w-full bg-muted-area border border-border-theme rounded-xl px-3 py-2 text-xs"
                  />
                </div>

                <div className="flex items-center gap-2 pt-2">
                  <input
                    type="checkbox"
                    id="popular"
                    checked={courseForm.isPopular}
                    onChange={e => setCourseForm(p => ({ ...p, isPopular: e.target.checked }))}
                    className="rounded border-border-theme text-primary focus:ring-primary"
                  />
                  <label htmlFor="popular" className="font-bold text-card-foreground cursor-pointer">
                    गृहपृष्ठमा लोकप्रिय कोर्सका रूपमा देखाउनुहोस् (Featured / Popular)
                  </label>
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-border-theme">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-4 py-2 rounded-xl bg-muted-area hover:bg-muted-area/80 font-bold"
                  >
                    रद्द गर्नुहोस्
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-xl bg-primary text-white font-bold flex items-center gap-1.5"
                  >
                    <Save size={14} /> सुरक्षित गर्नुहोस्
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
