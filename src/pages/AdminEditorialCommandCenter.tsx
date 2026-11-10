import React, { useState, useEffect } from "react";
import AdminLayout from "@/src/components/layout/AdminLayout";
import { 
  Command, 
  Flame, 
  Clock, 
  CheckCircle2, 
  AlertTriangle, 
  Users, 
  FileText, 
  Sparkles, 
  Zap, 
  RefreshCw, 
  Send, 
  Search, 
  Plus, 
  ChevronRight, 
  ShieldCheck, 
  Layers, 
  Radio, 
  TrendingUp,
  MapPin,
  Calendar,
  Check,
  ExternalLink,
  AlertCircle,
  XCircle,
  HelpCircle,
  Eye,
  CheckCircle,
  History
} from "lucide-react";
import { StoryEvolutionEngine, SEED_STORYLINE_ARCS } from "@/src/services/storyEvolutionEngine";
import { snapshotEngine } from "@/src/services/snapshotEngine";
import { contentRegistry } from "@/src/services/contentRegistry";
import { toast } from "sonner";
import type { StorylineArc, StoryMilestone } from "@/src/types";
import { useAuth } from "@/src/lib/auth";
import type { EditorialCandidate, EditorialCandidateStatus } from "@/src/types/editorial";

interface EditorialTask {
  id: string;
  title: string;
  category: string;
  district: string;
  stage: "leads" | "reporting" | "factcheck" | "approval" | "published";
  assignedTo: string;
  priority: "urgent" | "high" | "normal";
  deadline: string;
  wordCount: number;
  neutralityScore: number;
  sourcesVerified: boolean;
  storyArcId?: string;
}

const SAMPLE_EDITORIAL_TASKS: EditorialTask[] = [
  {
    id: "task-101",
    title: "पर्यटन पूर्वाधार तथा हवाई उडान सुरक्षासम्बन्धी नयाँ निर्देशिका",
    category: "पर्यटन",
    district: "कास्की",
    stage: "reporting",
    assignedTo: "सुनिता शर्मा (पोखरा ब्युरो)",
    priority: "urgent",
    deadline: "आज अपराह्न ४:००",
    wordCount: 650,
    neutralityScore: 94,
    sourcesVerified: true,
    storyArcId: "arc-tourism-policy-2026"
  },
  {
    id: "task-102",
    title: "४०० केभी ढल्केबर-मुजफ्फरपुर अन्तरदेशीय प्रसारण लाइन स्तरोन्नति",
    category: "अर्थ",
    district: "धनुषा",
    stage: "factcheck",
    assignedTo: "सागर राणा (आर्थिक ब्युरो)",
    priority: "high",
    deadline: "आज साँझ ६:००",
    wordCount: 820,
    neutralityScore: 98,
    sourcesVerified: true,
    storyArcId: "arc-hydropower-transmission-line-2026"
  },
  {
    id: "task-103",
    title: "संसदीय विशेष समितिद्वारा सार्वजनिक संस्थानहरूको वित्तीय लेखापरीक्षण प्रतिवेदन",
    category: "राजनीति",
    district: "काठमाडौं",
    stage: "approval",
    assignedTo: "रमेश अधिकारी (प्रमुख सम्पादक)",
    priority: "urgent",
    deadline: "आज बेलुका ८:००",
    wordCount: 1100,
    neutralityScore: 96,
    sourcesVerified: true
  },
  {
    id: "task-104",
    title: "तराई मधेस द्रुतमार्ग (Fast Track) सुरुङमार्ग ब्रेकथ्रुको पछिल्लो स्थिति",
    category: "विकास",
    district: "मकवानपुर",
    stage: "leads",
    assignedTo: "असाइन हुन बाँकी",
    priority: "normal",
    deadline: "भोली बिहान १०:००",
    wordCount: 400,
    neutralityScore: 90,
    sourcesVerified: false
  },
  {
    id: "task-105",
    title: "पशुपतिनाथ क्षेत्र बृहत् गुरुयोजना कार्यान्वयनको पहिलो चरण सम्पन्न",
    category: "संस्कृति",
    district: "काठमाडौं",
    stage: "published",
    assignedTo: "बिमल कार्की (संस्कृति डेस्क)",
    priority: "normal",
    deadline: "सम्पन्न",
    wordCount: 750,
    neutralityScore: 99,
    sourcesVerified: true
  }
];

export default function AdminEditorialCommandCenter() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<EditorialTask[]>(() => {
    const saved = localStorage.getItem("sanatan_editorial_tasks");
    return saved ? JSON.parse(saved) : SAMPLE_EDITORIAL_TASKS;
  });

  const [storylines, setStorylines] = useState<StorylineArc[]>(() => StoryEvolutionEngine.getStorylines());
  const [activeTab, setActiveTab] = useState<"candidates" | "kanban" | "arcs" | "policy" | "broadcast">("candidates");
  const [selectedTask, setSelectedTask] = useState<EditorialTask | null>(tasks[0] || null);
  const [isFlushingSnapshot, setIsFlushingSnapshot] = useState(false);
  const [showNewTaskModal, setShowNewTaskModal] = useState(false);

  // Phase 4B.1 Candidates State
  const [candidates, setCandidates] = useState<EditorialCandidate[]>([]);
  const [candidatesLoading, setCandidatesLoading] = useState(false);
  const [candidateFilterStatus, setCandidateFilterStatus] = useState<string>("all");
  const [selectedCandidate, setSelectedCandidate] = useState<EditorialCandidate | null>(null);
  const [isIngestModalOpen, setIsIngestModalOpen] = useState(false);
  const [isDrafting, setIsDrafting] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [reasonModal, setReasonModal] = useState<{ open: boolean; action: "reject" | "changes"; candidateId: string }>({
    open: false,
    action: "reject",
    candidateId: ""
  });
  const [reasonText, setReasonText] = useState("");

  // Ingest form state
  const [ingestForm, setIngestForm] = useState({
    title: "",
    category: "desh",
    sourceUrl: "",
    publisher: "",
    headline: "",
    publishedAt: "",
    excerpt: "",
    district: ""
  });

  // Fetch candidates from API
  const fetchCandidates = async () => {
    setCandidatesLoading(true);
    try {
      let url = "/api/editorial/candidates";
      if (candidateFilterStatus !== "all") {
        url += `?status=${encodeURIComponent(candidateFilterStatus)}`;
      }
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setCandidates(data.candidates || []);
        if (selectedCandidate) {
          const updated = (data.candidates || []).find((c: EditorialCandidate) => c.id === selectedCandidate.id);
          if (updated) setSelectedCandidate(updated);
        }
      }
    } catch (err: any) {
      console.warn("Failed to fetch candidates:", err);
    } finally {
      setCandidatesLoading(false);
    }
  };

  useEffect(() => {
    fetchCandidates();
  }, [candidateFilterStatus]);

  // Handle Candidate Ingest
  const handleIngestCandidate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ingestForm.title.trim() || !ingestForm.sourceUrl.trim() || !ingestForm.excerpt.trim()) {
      toast.error("शीर्षक, स्रोत लिंक र प्रमाण अंश अनिवार्य छन् (No Source = No Story)");
      return;
    }

    try {
      const res = await fetch("/api/editorial/candidates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(ingestForm)
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success("नयाँ स्रोत प्रमाण सफलतापूर्वक दर्ता भयो!");
        setIsIngestModalOpen(false);
        setIngestForm({
          title: "",
          category: "desh",
          sourceUrl: "",
          publisher: "",
          headline: "",
          publishedAt: "",
          excerpt: "",
          district: ""
        });
        fetchCandidates();
      } else {
        toast.error(data.error || "स्रोत दर्ता गर्दा त्रुटि भयो");
      }
    } catch (err: any) {
      toast.error(`त्रुटि: ${err.message}`);
    }
  };

  // Generate AI Draft
  const handleGenerateDraft = async (candId: string) => {
    setIsDrafting(true);
    try {
      const res = await fetch(`/api/editorial/candidates/${candId}/draft`, {
        method: "POST"
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success("AI सम्पादकीय मस्यौदा तयार भयो!");
        fetchCandidates();
      } else {
        toast.error(data.error || "मस्यौदा बनाउन असफल भयो");
      }
    } catch (err: any) {
      toast.error(`त्रुटि: ${err.message}`);
    } finally {
      setIsDrafting(false);
    }
  };

  // Assign Review
  const handleAssignReview = async (candId: string, currentVersion: number) => {
    try {
      const res = await fetch(`/api/editorial/candidates/${candId}/assign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ expectedVersion: currentVersion })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success("क्यान्डिडेट समीक्षाको लागि जिम्मेवारीमा लिइयो");
        fetchCandidates();
      } else {
        toast.error(data.error || "समीक्षा असाइन गर्न सकिएन");
      }
    } catch (err: any) {
      toast.error(`त्रुटि: ${err.message}`);
    }
  };

  // Approve Candidate
  const handleApprove = async (candId: string, currentVersion: number) => {
    try {
      const res = await fetch(`/api/editorial/candidates/${candId}/transition`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetStatus: "approved",
          expectedVersion: currentVersion,
          reason: "सम्पादकद्वारा तथ्य र स्रोत परीक्षण सम्पन्न गरी स्वीकृत"
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success("क्यान्डिडेट प्रकाशनका लागि स्वीकृत भयो!");
        fetchCandidates();
      } else {
        toast.error(data.error || "स्वीकृति असफल भयो");
      }
    } catch (err: any) {
      toast.error(`त्रुटि: ${err.message}`);
    }
  };

  // Submit Reason for Reject or Changes
  const handleSubmitReason = async () => {
    if (!reasonText.trim()) {
      toast.error("कारण खुलाउनु अनिवार्य छ");
      return;
    }
    const targetStatus = reasonModal.action === "reject" ? "rejected" : "changes_requested";
    const cand = candidates.find(c => c.id === reasonModal.candidateId);
    if (!cand) return;

    try {
      const res = await fetch(`/api/editorial/candidates/${cand.id}/transition`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetStatus,
          expectedVersion: cand.version,
          reason: reasonText.trim()
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(targetStatus === "rejected" ? "क्यान्डिडेट अस्वीकृत गरियो" : "सुधार माग पठाइयो");
        setReasonModal({ open: false, action: "reject", candidateId: "" });
        setReasonText("");
        fetchCandidates();
      } else {
        toast.error(data.error || "कार्य सम्पन्न हुन सकेन");
      }
    } catch (err: any) {
      toast.error(`त्रुटि: ${err.message}`);
    }
  };

  // Publish to Canonical News
  const handlePublish = async (candId: string) => {
    setIsPublishing(true);
    try {
      const res = await fetch(`/api/editorial/candidates/${candId}/publish`, {
        method: "POST"
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(`क्यानोनिकल समाचार प्रकाशित भयो! ID: ${data.articleId}`);
        fetchCandidates();
      } else {
        toast.error(data.error || "प्रकाशन असफल भयो");
      }
    } catch (err: any) {
      toast.error(`त्रुटि: ${err.message}`);
    } finally {
      setIsPublishing(false);
    }
  };

  // New task form state
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskCategory, setNewTaskCategory] = useState("राजनीति");
  const [newTaskDistrict, setNewTaskDistrict] = useState("काठमाडौं");
  const [newTaskAssignee, setNewTaskAssignee] = useState("सागर राणा (आर्थिक ब्युरो)");
  const [newTaskPriority, setNewTaskPriority] = useState<"urgent" | "high" | "normal">("high");

  useEffect(() => {
    try {
      localStorage.setItem("sanatan_editorial_tasks", JSON.stringify(tasks));
    } catch (e) {}
  }, [tasks]);

  const handleAdvanceStage = (taskId: string) => {
    const stageOrder: EditorialTask["stage"][] = ["leads", "reporting", "factcheck", "approval", "published"];
    setTasks(prev => prev.map(t => {
      if (t.id === taskId) {
        const currentIndex = stageOrder.indexOf(t.stage);
        const nextStage = stageOrder[Math.min(currentIndex + 1, stageOrder.length - 1)];
        toast.success(`कार्य '${t.title.slice(0, 20)}...' स्थिति '${nextStage}' मा सारियो`);

        if (nextStage === "published") {
          contentRegistry.registerArticle({
            articleId: t.id,
            title: t.title,
            status: "published",
            publishedAt: new Date().toISOString(),
            snapshotVersion: "v5.0-master",
            cacheVersion: `cache-${Date.now()}`,
            firestoreVersion: 1
          });
        }

        return { ...t, stage: nextStage };
      }
      return t;
    }));
  };

  const handleCreateTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;

    const newTask: EditorialTask = {
      id: `task-${Date.now()}`,
      title: newTaskTitle.trim(),
      category: newTaskCategory,
      district: newTaskDistrict,
      stage: "leads",
      assignedTo: newTaskAssignee,
      priority: newTaskPriority,
      deadline: "आज अपराह्न ५:००",
      wordCount: 0,
      neutralityScore: 95,
      sourcesVerified: false
    };

    setTasks(prev => [newTask, ...prev]);
    setShowNewTaskModal(false);
    setNewTaskTitle("");
    toast.success("नयाँ सम्पादकीय असाइनमेन्ट दर्ता भयो!");
  };

  const handleFlushAndRebuild = async () => {
    setIsFlushingSnapshot(true);
    try {
      await snapshotEngine.triggerServerRebuild({ triggerSource: "editorial_command_center" });
      toast.success("स्न्यापसट क्यास सफा गरियो र एज नेटवर्कमा रिबिल्ड भयो!");
    } catch (e: any) {
      toast.error("रिबिल्ड गर्दा त्रुटि भयो");
    } finally {
      setIsFlushingSnapshot(false);
    }
  };

  const STAGES: { key: EditorialTask["stage"]; label: string; count: number; color: string }[] = [
    { key: "leads", label: "१. स्रोत तथा संकेत (Leads)", count: tasks.filter(t => t.stage === "leads").length, color: "border-slate-500 text-slate-600 dark:text-slate-400" },
    { key: "reporting", label: "२. अनुसन्धान तथा लेखन (Reporting)", count: tasks.filter(t => t.stage === "reporting").length, color: "border-blue-500 text-blue-600 dark:text-blue-400" },
    { key: "factcheck", label: "३. तथ्य परीक्षण (Fact-Check)", count: tasks.filter(t => t.stage === "factcheck").length, color: "border-amber-500 text-amber-600 dark:text-amber-400" },
    { key: "approval", label: "४. सम्पादकीय स्वीकृति (Approval)", count: tasks.filter(t => t.stage === "approval").length, color: "border-purple-500 text-purple-600 dark:text-purple-400" },
    { key: "published", label: "५. प्रत्यक्ष प्रसारण (Published)", count: tasks.filter(t => t.stage === "published").length, color: "border-emerald-500 text-emerald-600 dark:text-emerald-400" },
  ];

  const getStatusBadge = (status: EditorialCandidateStatus) => {
    switch (status) {
      case "discovered":
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-500/10 text-slate-600">खोज गरिएको (Discovered)</span>;
      case "source_verified":
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/10 text-blue-600">स्रोत प्रमाणित (Source Verified)</span>;
      case "pending_review":
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-600">समीक्षा पर्खाइमा (Pending Review)</span>;
      case "in_review":
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/10 text-purple-600">समीक्षामा (In Review)</span>;
      case "changes_requested":
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-orange-500/10 text-orange-600">सुधार माग (Changes Requested)</span>;
      case "approved":
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600">स्वीकृत (Approved)</span>;
      case "published":
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-600 text-white">प्रकाशित (Published)</span>;
      case "rejected":
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-500/10 text-red-600">अस्वीकृत (Rejected)</span>;
      case "expired":
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-zinc-500/10 text-zinc-600">म्याद सकिएको (Expired)</span>;
      default:
        return null;
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6 pb-12">
        
        {/* Top Newsroom Header */}
        <div className="p-6 md:p-8 rounded-3xl bg-surface border border-border shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-primary/10 text-primary mb-2">
              <Command className="w-3.5 h-3.5" />
              Newsroom 5.0 • Editorial Workflow Foundation (Phase 4B.1)
            </div>
            <h1 className="text-2xl md:text-3xl font-extrabold font-display tracking-tight text-foreground">
              सम्पादकीय कमान्ड सेन्टर (Editorial Command Center)
            </h1>
            <p className="text-xs md:text-sm text-muted-foreground mt-1">
              "No Source = No Story" सिद्धान्तमा आधारित प्रमाण-सत्यापन, AI मस्यौदा, सम्पादक स्वीकृति र क्यानोनिकल प्रकाशन।
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => setIsIngestModalOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-primary text-white text-xs font-bold shadow-md hover:bg-primary/90 transition-all"
            >
              <Plus className="w-4 h-4" /> नयाँ स्रोत प्रमाण दर्ता
            </button>

            <button
              onClick={fetchCandidates}
              disabled={candidatesLoading}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-muted text-foreground border border-border text-xs font-bold hover:bg-muted/80 transition-all"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-primary ${candidatesLoading ? "animate-spin" : ""}`} />
              ताजा सूची
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 border-b border-border pb-3 overflow-x-auto">
          {[
            { id: "candidates", label: "सम्पादकीय क्यान्डिडेटहरू (Candidates - 4B.1)", icon: Sparkles },
            { id: "kanban", label: "पाइपलाइन बोर्ड (Kanban Pipeline)", icon: Layers },
            { id: "arcs", label: "विकासशील शृङ्खलाहरू (Story Arcs)", icon: Flame },
            { id: "policy", label: "तथ्य तथा तटस्थता अडिट (Policy Audit)", icon: ShieldCheck },
            { id: "broadcast", label: "आपतकालीन प्रसारण (Breaking Push)", icon: Radio }
          ].map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                  isActive 
                    ? "bg-primary text-white shadow-sm" 
                    : "bg-surface text-muted-foreground hover:text-foreground border border-border"
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Tab 1: Editorial Candidates (Phase 4B.1) */}
        {activeTab === "candidates" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Left 2 Cols: Candidates List */}
            <div className="lg:col-span-2 space-y-4">
              
              {/* Status Filter Chips */}
              <div className="flex items-center gap-2 overflow-x-auto pb-1">
                {[
                  { key: "all", label: "सबै" },
                  { key: "discovered", label: "खोज गरिएको" },
                  { key: "source_verified", label: "प्रमाणित स्रोत" },
                  { key: "pending_review", label: "समीक्षा पर्खाइमा" },
                  { key: "in_review", label: "समीक्षामा" },
                  { key: "changes_requested", label: "सुधार माग" },
                  { key: "approved", label: "स्वीकृत" },
                  { key: "published", label: "प्रकाशित" },
                  { key: "rejected", label: "अस्वीकृत" }
                ].map(chip => (
                  <button
                    key={chip.key}
                    onClick={() => setCandidateFilterStatus(chip.key)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                      candidateFilterStatus === chip.key
                        ? "bg-foreground text-background"
                        : "bg-muted text-muted-foreground hover:text-foreground border border-border"
                    }`}
                  >
                    {chip.label}
                  </button>
                ))}
              </div>

              {candidatesLoading && (
                <div className="p-8 text-center text-xs text-muted-foreground border border-dashed border-border rounded-3xl">
                  क्यान्डिडेटहरू लोड हुँदैछन्...
                </div>
              )}

              {!candidatesLoading && candidates.length === 0 && (
                <div className="p-12 text-center border border-dashed border-border rounded-3xl bg-surface space-y-3">
                  <Sparkles className="w-8 h-8 text-muted-foreground mx-auto opacity-40" />
                  <p className="text-sm font-bold text-foreground">कुनै क्यान्डिडेट फेला परेन</p>
                  <p className="text-xs text-muted-foreground max-w-md mx-auto">
                    वास्तविक समाचार स्रोत प्रमाण दर्ता गर्नुहोस्। "No Source = No Story" सिद्धान्तअनुसार प्रत्येक क्यान्डिडेट सत्य स्रोतबाट मात्र सुरु हुन्छ।
                  </p>
                  <button
                    onClick={() => setIsIngestModalOpen(true)}
                    className="mt-2 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-white text-xs font-bold"
                  >
                    <Plus className="w-3.5 h-3.5" /> नयाँ स्रोत प्रमाण दर्ता गर्नुहोस्
                  </button>
                </div>
              )}

              <div className="space-y-3">
                {candidates.map(cand => (
                  <div
                    key={cand.id}
                    onClick={() => setSelectedCandidate(cand)}
                    className={`p-5 rounded-3xl bg-surface border transition-all cursor-pointer shadow-sm flex flex-col gap-3 ${
                      selectedCandidate?.id === cand.id ? "border-primary ring-2 ring-primary/20" : "border-border hover:border-primary/40"
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        {getStatusBadge(cand.status)}
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-muted text-foreground">
                          {cand.category}
                        </span>
                        {cand.primarySource?.isGovernmentPortal && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-500/10 text-blue-600 flex items-center gap-1">
                            <ShieldCheck className="w-3 h-3" /> आधिकारिक सरकारी पोर्टल
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                        <Clock className="w-3 h-3" />
                        <span>ताजगी: {cand.freshnessScore}/100</span>
                        <span>• v{cand.version}</span>
                      </div>
                    </div>

                    <div>
                      <h4 className="text-sm md:text-base font-bold text-foreground font-display leading-snug">
                        {cand.title}
                      </h4>
                      <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
                        {cand.primarySource?.excerpt}
                      </p>
                    </div>

                    <div className="pt-3 border-t border-border flex flex-wrap items-center justify-between gap-2 text-xs">
                      <a
                        href={cand.primarySource?.canonicalUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="text-primary hover:underline inline-flex items-center gap-1 font-semibold text-[11px] truncate max-w-[280px]"
                      >
                        <ExternalLink className="w-3 h-3 flex-shrink-0" />
                        {cand.primarySource?.publisher || cand.primarySource?.publisherDomain}
                      </a>

                      <div className="flex items-center gap-2">
                        {cand.status === "source_verified" && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleGenerateDraft(cand.id);
                            }}
                            disabled={isDrafting}
                            className="px-3 py-1 rounded-xl bg-primary text-white text-[11px] font-bold flex items-center gap-1 hover:bg-primary/90"
                          >
                            <Sparkles className="w-3 h-3" /> AI मस्यौदा
                          </button>
                        )}

                        {cand.status === "pending_review" && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleAssignReview(cand.id, cand.version);
                            }}
                            className="px-3 py-1 rounded-xl bg-purple-600 text-white text-[11px] font-bold flex items-center gap-1 hover:bg-purple-700"
                          >
                            <Users className="w-3 h-3" /> समीक्षा सुरु
                          </button>
                        )}

                        {cand.status === "in_review" && (
                          <div className="flex items-center gap-1">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setReasonModal({ open: true, action: "changes", candidateId: cand.id });
                              }}
                              className="px-2.5 py-1 rounded-xl bg-orange-500/10 text-orange-600 text-[11px] font-bold hover:bg-orange-500/20"
                            >
                              सुधार माग
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleApprove(cand.id, cand.version);
                              }}
                              className="px-2.5 py-1 rounded-xl bg-emerald-600 text-white text-[11px] font-bold hover:bg-emerald-700"
                            >
                              स्वीकृत
                            </button>
                          </div>
                        )}

                        {cand.status === "approved" && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handlePublish(cand.id);
                            }}
                            disabled={isPublishing}
                            className="px-3 py-1 rounded-xl bg-emerald-600 text-white text-[11px] font-bold flex items-center gap-1 hover:bg-emerald-700"
                          >
                            <Send className="w-3 h-3" /> क्यानोनिकल प्रकाशन
                          </button>
                        )}

                        {cand.status === "published" && cand.publishedArticleId && (
                          <span className="text-[11px] font-mono text-emerald-600 font-bold">
                            {cand.publishedArticleId}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Right Col: Selected Candidate Detail & History */}
            <div className="space-y-4">
              {selectedCandidate ? (
                <div className="p-6 rounded-3xl bg-surface border border-border shadow-sm space-y-6">
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <span className="text-xs font-bold text-muted-foreground">क्यान्डिडेट विवरण</span>
                      {getStatusBadge(selectedCandidate.status)}
                    </div>
                    <h3 className="text-base font-bold text-foreground font-display">
                      {selectedCandidate.title}
                    </h3>
                  </div>

                  {/* Primary Source Evidence Card */}
                  <div className="p-4 rounded-2xl bg-muted/30 border border-border space-y-2">
                    <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block">
                      प्राथमिक स्रोत प्रमाण (Primary Source)
                    </span>
                    <div className="text-xs font-semibold text-foreground flex items-center justify-between">
                      <span>{selectedCandidate.primarySource?.publisher}</span>
                      <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-600 font-bold">
                        {selectedCandidate.primarySource?.verificationStatus}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground italic bg-background/50 p-3 rounded-xl border border-border/50">
                      "{selectedCandidate.primarySource?.excerpt}"
                    </p>
                    <div className="text-[11px] text-muted-foreground break-all">
                      <span className="font-semibold text-foreground">URL: </span>
                      <a 
                        href={selectedCandidate.primarySource?.canonicalUrl} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-primary hover:underline"
                      >
                        {selectedCandidate.primarySource?.canonicalUrl}
                      </a>
                    </div>
                    <div className="text-[10px] text-muted-foreground font-mono">
                      Fingerprint: {selectedCandidate.contentFingerprint?.slice(0, 16)}...
                    </div>
                  </div>

                  {/* Proposed AI Draft */}
                  {selectedCandidate.proposedDraft ? (
                    <div className="p-4 rounded-2xl bg-primary/5 border border-primary/20 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-primary flex items-center gap-1.5">
                          <Sparkles className="w-3.5 h-3.5" /> AI प्रस्तावित मस्यौदा (Draft)
                        </span>
                        <span className="text-[10px] font-mono text-muted-foreground">
                          {selectedCandidate.proposedDraft.generatedModel}
                        </span>
                      </div>
                      <h4 className="text-xs font-bold text-foreground">
                        {selectedCandidate.proposedDraft.headline}
                      </h4>
                      <p className="text-xs text-muted-foreground">
                        {selectedCandidate.proposedDraft.summary}
                      </p>
                    </div>
                  ) : (
                    <div className="p-4 rounded-2xl border border-dashed border-border text-center space-y-2">
                      <p className="text-xs text-muted-foreground">अहिलेसम्म मस्यौदा तयार गरिएको छैन</p>
                      <button
                        onClick={() => handleGenerateDraft(selectedCandidate.id)}
                        disabled={isDrafting}
                        className="px-3 py-1.5 rounded-xl bg-primary text-white text-xs font-bold inline-flex items-center gap-1.5"
                      >
                        <Sparkles className="w-3.5 h-3.5" /> मस्यौदा तयार गर्नुहोस्
                      </button>
                    </div>
                  )}

                  {/* Editorial Audit History */}
                  <div className="space-y-3">
                    <span className="text-xs font-bold text-foreground flex items-center gap-1.5 font-display">
                      <History className="w-3.5 h-3.5 text-primary" /> सम्पादकीय इतिहास तथा अडिट (Audit Trail)
                    </span>
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                      {(selectedCandidate.history || []).map((h) => (
                        <div key={h.id} className="p-2.5 rounded-xl bg-muted/40 text-[11px] space-y-1">
                          <div className="flex items-center justify-between text-muted-foreground font-semibold">
                            <span>{h.fromStatus} → {h.toStatus}</span>
                            <span>v{h.version}</span>
                          </div>
                          <div className="text-foreground">{h.reason}</div>
                          <div className="text-[10px] text-muted-foreground flex justify-between">
                            <span>{h.actorRole} ({h.actorEmail || h.actorUid})</span>
                            <span>{new Date(h.timestamp).toLocaleTimeString("ne-NP")}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Actions Bar */}
                  <div className="pt-4 border-t border-border flex flex-wrap items-center gap-2">
                    {selectedCandidate.status === "in_review" && (
                      <>
                        <button
                          onClick={() => handleApprove(selectedCandidate.id, selectedCandidate.version)}
                          className="flex-1 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700"
                        >
                          स्वीकृत गर्नुहोस्
                        </button>
                        <button
                          onClick={() => setReasonModal({ open: true, action: "reject", candidateId: selectedCandidate.id })}
                          className="px-4 py-2 rounded-xl bg-red-500/10 text-red-600 text-xs font-bold hover:bg-red-500/20"
                        >
                          अस्वीकार
                        </button>
                      </>
                    )}

                    {selectedCandidate.status === "approved" && (
                      <button
                        onClick={() => handlePublish(selectedCandidate.id)}
                        disabled={isPublishing}
                        className="w-full py-2.5 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 flex items-center justify-center gap-1.5"
                      >
                        <Send className="w-3.5 h-3.5" /> क्यानोनिकल समाचारमा प्रकाशन गर्नुहोस्
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <div className="p-8 rounded-3xl bg-surface border border-dashed border-border text-center text-xs text-muted-foreground">
                  सूचीबाट कुनै क्यान्डिडेट चयन गर्नुहोस्
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab 2: Kanban Pipeline (Preserved from 3.0) */}
        {activeTab === "kanban" && (
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            {STAGES.map(stage => {
              const stageTasks = tasks.filter(t => t.stage === stage.key);
              return (
                <div key={stage.key} className="flex flex-col bg-muted/40 rounded-3xl p-4 border border-border min-h-[500px]">
                  <div className="flex items-center justify-between pb-3 mb-3 border-b border-border">
                    <span className="text-xs font-bold text-foreground">
                      {stage.label}
                    </span>
                    <span className="w-5 h-5 rounded-full bg-surface border border-border flex items-center justify-center text-[10px] font-black text-muted-foreground">
                      {stageTasks.length}
                    </span>
                  </div>

                  <div className="space-y-3 flex-grow overflow-y-auto">
                    {stageTasks.map(task => (
                      <div
                        key={task.id}
                        onClick={() => setSelectedTask(task)}
                        className={`p-4 rounded-2xl bg-surface border transition-all cursor-pointer shadow-sm flex flex-col justify-between gap-3 ${
                          selectedTask?.id === task.id ? "border-primary ring-2 ring-primary/20" : "border-border hover:border-primary/40"
                        }`}
                      >
                        <div>
                          <div className="flex items-center justify-between gap-2 mb-1.5">
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-primary/10 text-primary">
                              {task.category}
                            </span>
                            <span className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded ${
                              task.priority === "urgent" ? "bg-red-500/10 text-red-600" :
                              task.priority === "high" ? "bg-amber-500/10 text-amber-600" :
                              "bg-slate-500/10 text-slate-600"
                            }`}>
                              {task.priority}
                            </span>
                          </div>
                          <h4 className="text-xs font-bold text-foreground font-display leading-snug line-clamp-2">
                            {task.title}
                          </h4>
                        </div>

                        <div className="pt-2 border-t border-border flex items-center justify-between text-[11px] text-muted-foreground">
                          <span className="truncate max-w-[120px]">{task.assignedTo.split(" ")[0]}</span>
                          {stage.key !== "published" && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleAdvanceStage(task.id);
                              }}
                              title="अर्को चरणमा सार्नुहोस्"
                              className="w-6 h-6 rounded-lg bg-primary/10 hover:bg-primary hover:text-white text-primary flex items-center justify-center transition-colors"
                            >
                              <ChevronRight className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Tab 3: Story Arcs Coordination (Preserved) */}
        {activeTab === "arcs" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-4">
              <h3 className="text-sm font-bold text-foreground flex items-center gap-2 font-display">
                <Flame className="w-4 h-4 text-amber-500" /> सक्रिय राष्ट्रिय नीतिगत शृङ्खलाहरू
              </h3>
              {storylines.map(arc => (
                <div key={arc.id} className="p-6 rounded-3xl bg-surface border border-border shadow-sm">
                  <div className="flex items-center justify-between gap-4 mb-2">
                    <h4 className="text-base font-bold text-foreground font-display">
                      {arc.titleNepali}
                    </h4>
                    <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-600">
                      {arc.status === "developing" ? "विकासशील" : "सक्रिय"}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mb-4">
                    {arc.summaryNepali}
                  </p>
                  
                  <div className="border-t border-border pt-3">
                    <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block mb-2">
                      पछिल्ला घटनाक्रमहरू ({arc.milestones.length})
                    </span>
                    <div className="space-y-2">
                      {arc.milestones.slice(0, 3).map(m => (
                        <div key={m.id} className="p-2.5 rounded-xl bg-muted/40 text-xs flex items-center justify-between">
                          <span className="font-semibold text-foreground">{m.title}</span>
                          <span className="text-[10px] text-muted-foreground">{m.date}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Quick Metrics */}
            <div className="p-6 rounded-3xl bg-surface border border-border shadow-sm h-fit space-y-4">
              <h3 className="text-sm font-bold text-foreground font-display">
                शृङ्खला स्वास्थ्य सूचक
              </h3>
              <div className="space-y-3">
                <div className="p-3.5 rounded-2xl bg-muted/40 text-xs flex justify-between items-center">
                  <span className="text-muted-foreground">सक्रिय स्टोरी आर्कहरू</span>
                  <span className="font-bold text-foreground">{storylines.length} वटा</span>
                </div>
                <div className="p-3.5 rounded-2xl bg-muted/40 text-xs flex justify-between items-center">
                  <span className="text-muted-foreground">असाइन गरिएका पत्रकारहरू</span>
                  <span className="font-bold text-emerald-600">१२ जना</span>
                </div>
                <div className="p-3.5 rounded-2xl bg-muted/40 text-xs flex justify-between items-center">
                  <span className="text-muted-foreground">०६:०० AM ब्रिफिङ स्थिति</span>
                  <span className="font-bold text-primary">तयार</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 4: Policy & Neutrality Audit (Preserved) */}
        {activeTab === "policy" && (
          <div className="p-6 rounded-3xl bg-surface border border-border shadow-sm max-w-4xl mx-auto space-y-6">
            <div>
              <h3 className="text-lg font-bold text-foreground font-display flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-emerald-600" /> सम्पादकीय नीति तथा निष्पक्षता अडिट (Editorial Neutrality)
              </h3>
              <p className="text-xs text-muted-foreground mt-1">
                सनातन मार्ग सत्यनिष्ठा निर्देशिका र तथ्य परीक्षण मानक।
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 rounded-2xl bg-muted/30 border border-border">
                <span className="text-xs text-muted-foreground block mb-1">औसत निष्पक्षता स्कोर</span>
                <span className="text-2xl font-black text-emerald-600">९६.४%</span>
              </div>
              <div className="p-4 rounded-2xl bg-muted/30 border border-border">
                <span className="text-xs text-muted-foreground block mb-1">तथ्य जाँच पुष्टि दर</span>
                <span className="text-2xl font-black text-primary">१००%</span>
              </div>
              <div className="p-4 rounded-2xl bg-muted/30 border border-border">
                <span className="text-xs text-muted-foreground block mb-1">विवादास्पद दाबी चेतावनी</span>
                <span className="text-2xl font-black text-slate-500">०</span>
              </div>
            </div>
          </div>
        )}

        {/* Tab 5: Broadcast Push Alert (Preserved) */}
        {activeTab === "broadcast" && (
          <div className="p-6 rounded-3xl bg-surface border border-border shadow-sm max-w-2xl mx-auto space-y-6">
            <div>
              <h3 className="text-lg font-bold text-foreground font-display flex items-center gap-2">
                <Radio className="w-5 h-5 text-red-500" /> आपतकालीन ब्रेकिङ प्रसारण (Breaking Alert Push)
              </h3>
              <p className="text-xs text-muted-foreground mt-1">
                वेब तथा मोबाइल एप्सका सबै पाठकहरूलाई तत्काल हाइ-प्रायोरिटी ब्रेकिङ सूचना पठाउनुहोस्।
              </p>
            </div>

            <form onSubmit={(e) => {
              e.preventDefault();
              toast.success("ब्रेकिङ अलर्ट पाठकहरूलाई सफलतापूर्वक प्रसारण भयो!");
            }} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-muted-foreground mb-1.5">ब्रेकिङ शीर्षक</label>
                <input 
                  type="text" 
                  placeholder="उदा: काठमाडौं उपत्यकामा भारी वर्षा, सतर्क रहन आग्रह..."
                  className="w-full px-4 py-2.5 rounded-xl border border-border bg-background text-sm font-semibold focus:outline-none focus:border-primary"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-muted-foreground mb-1.5">लक्षित क्षेत्र/जिल्ला</label>
                <select className="w-full px-4 py-2.5 rounded-xl border border-border bg-background text-sm font-semibold focus:outline-none focus:border-primary">
                  <option value="all">समग्र नेपाल (राष्ट्रिय)</option>
                  <option value="kathmandu">काठमाडौं उपत्यका</option>
                  <option value="kaski">गण्डकी प्रदेश</option>
                </select>
              </div>

              <button
                type="submit"
                className="w-full py-3 rounded-2xl bg-red-600 text-white font-bold text-sm shadow-md hover:bg-red-700 transition-all flex items-center justify-center gap-2"
              >
                <Radio className="w-4 h-4 animate-pulse" /> तत्काल ब्रेकिङ प्रसारण गर्नुहोस्
              </button>
            </form>
          </div>
        )}

      </div>

      {/* Ingest Source Evidence Modal (Phase 4B.1) */}
      {isIngestModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-surface border border-border rounded-3xl p-6 max-w-lg w-full shadow-2xl animate-in zoom-in-95 duration-200">
            <h3 className="text-lg font-bold font-display text-foreground mb-1">
              नयाँ स्रोत प्रमाण दर्ता (Source Ingest)
            </h3>
            <p className="text-xs text-muted-foreground mb-4">
              "No Source = No Story": वास्तविक समाचार URL र तथ्य प्रमाण अंश अनिवार्य छ।
            </p>
            <form onSubmit={handleIngestCandidate} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-muted-foreground mb-1">समाचार विषय / शीर्षक *</label>
                <input
                  type="text"
                  required
                  value={ingestForm.title}
                  onChange={(e) => setIngestForm(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="समाचार शीर्षक..."
                  className="w-full px-4 py-2 rounded-xl border border-border bg-background text-xs font-semibold focus:outline-none focus:border-primary"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-muted-foreground mb-1">स्रोत लिङ्क (Canonical Source URL) *</label>
                <input
                  type="url"
                  required
                  value={ingestForm.sourceUrl}
                  onChange={(e) => setIngestForm(prev => ({ ...prev, sourceUrl: e.target.value }))}
                  placeholder="https://gorkhapatraonline.com/news/..."
                  className="w-full px-4 py-2 rounded-xl border border-border bg-background text-xs font-semibold focus:outline-none focus:border-primary"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-muted-foreground mb-1">विधा (Category)</label>
                  <select
                    value={ingestForm.category}
                    onChange={(e) => setIngestForm(prev => ({ ...prev, category: e.target.value }))}
                    className="w-full px-4 py-2 rounded-xl border border-border bg-background text-xs font-bold focus:outline-none focus:border-primary"
                  >
                    <option value="desh">देश (Desh)</option>
                    <option value="politics">राजनीति (Politics)</option>
                    <option value="economy">अर्थ (Economy)</option>
                    <option value="culture">संस्कृति (Culture)</option>
                    <option value="technology">प्रविधि (Technology)</option>
                    <option value="sports">खेलकुद (Sports)</option>
                    <option value="sanatan">सनातन (Sanatan)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-muted-foreground mb-1">प्रकाशन गृह (Publisher)</label>
                  <input
                    type="text"
                    value={ingestForm.publisher}
                    onChange={(e) => setIngestForm(prev => ({ ...prev, publisher: e.target.value }))}
                    placeholder="उदा: गोरखापत्र / सेतोपाटी"
                    className="w-full px-4 py-2 rounded-xl border border-border bg-background text-xs font-semibold focus:outline-none focus:border-primary"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-muted-foreground mb-1">स्रोत प्रमाण अंश (Evidence Excerpt) *</label>
                <textarea
                  required
                  rows={3}
                  value={ingestForm.excerpt}
                  onChange={(e) => setIngestForm(prev => ({ ...prev, excerpt: e.target.value }))}
                  placeholder="स्रोतबाट संकलित मुख्य तथ्य विवरण यहाँ राख्नुहोस्..."
                  className="w-full px-4 py-2 rounded-xl border border-border bg-background text-xs font-semibold focus:outline-none focus:border-primary"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-border">
                <button
                  type="button"
                  onClick={() => setIsIngestModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-muted-foreground hover:bg-muted"
                >
                  रद्द गर्नुहोस्
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-primary text-white text-xs font-bold shadow-md hover:bg-primary/90"
                >
                  दर्ता गर्नुहोस्
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Rejection / Changes Reason Modal */}
      {reasonModal.open && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-surface border border-border rounded-3xl p-6 max-w-md w-full shadow-2xl animate-in zoom-in-95 duration-200">
            <h3 className="text-base font-bold font-display text-foreground mb-1">
              {reasonModal.action === "reject" ? "क्यान्डिडेट अस्वीकार गर्ने कारण" : "सुधार माग गर्ने कारण खुलाउनुहोस्"}
            </h3>
            <p className="text-xs text-muted-foreground mb-4">
              सम्पादकीय अडिटका लागि स्पष्ट कारण खुलाउनु अनिवार्य छ।
            </p>
            <textarea
              required
              rows={3}
              value={reasonText}
              onChange={(e) => setReasonText(e.target.value)}
              placeholder="कारण लेख्नुहोस्..."
              className="w-full px-4 py-2.5 rounded-xl border border-border bg-background text-xs font-semibold focus:outline-none focus:border-primary mb-4"
            />
            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setReasonModal({ open: false, action: "reject", candidateId: "" })}
                className="px-4 py-2 rounded-xl text-xs font-bold text-muted-foreground hover:bg-muted"
              >
                रद्द गर्नुहोस्
              </button>
              <button
                type="button"
                onClick={handleSubmitReason}
                className={`px-5 py-2 rounded-xl text-white text-xs font-bold shadow-md ${
                  reasonModal.action === "reject" ? "bg-red-600 hover:bg-red-700" : "bg-orange-600 hover:bg-orange-700"
                }`}
              >
                पुष्टि गर्नुहोस्
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New Task Assignment Modal (Preserved) */}
      {showNewTaskModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-surface border border-border rounded-3xl p-6 max-w-lg w-full shadow-2xl animate-in zoom-in-95 duration-200">
            <h3 className="text-lg font-bold font-display text-foreground mb-4">
              नयाँ सम्पादकीय असाइनमेन्ट
            </h3>
            <form onSubmit={handleCreateTask} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-muted-foreground mb-1.5">समाचार शीर्षक / विषय</label>
                <input
                  type="text"
                  required
                  value={newTaskTitle}
                  onChange={(e) => setNewTaskTitle(e.target.value)}
                  placeholder="समाचार शीर्षक लेख्नुहोस्..."
                  className="w-full px-4 py-2.5 rounded-xl border border-border bg-background text-sm font-semibold focus:outline-none focus:border-primary"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-muted-foreground mb-1.5">विधा</label>
                  <select
                    value={newTaskCategory}
                    onChange={(e) => setNewTaskCategory(e.target.value)}
                    className="w-full px-4 py-2 rounded-xl border border-border bg-background text-xs font-bold focus:outline-none focus:border-primary"
                  >
                    <option value="राजनीति">राजनीति</option>
                    <option value="अर्थ">अर्थ</option>
                    <option value="पर्यटन">पर्यटन</option>
                    <option value="संस्कृति">संस्कृति</option>
                    <option value="विकास">विकास</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-muted-foreground mb-1.5">जिल्ला</label>
                  <select
                    value={newTaskDistrict}
                    onChange={(e) => setNewTaskDistrict(e.target.value)}
                    className="w-full px-4 py-2 rounded-xl border border-border bg-background text-xs font-bold focus:outline-none focus:border-primary"
                  >
                    <option value="काठमाडौं">काठमाडौं</option>
                    <option value="कास्की">कास्की</option>
                    <option value="चितवन">चितवन</option>
                    <option value="झापा">झापा</option>
                    <option value="धनुषा">धनुषा</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-muted-foreground mb-1.5">जिम्मेवार पत्रकार</label>
                <select
                  value={newTaskAssignee}
                  onChange={(e) => setNewTaskAssignee(e.target.value)}
                  className="w-full px-4 py-2 rounded-xl border border-border bg-background text-xs font-bold focus:outline-none focus:border-primary"
                >
                  <option value="सागर राणा (आर्थिक ब्युरो)">सागर राणा (आर्थिक ब्युरो)</option>
                  <option value="सुनिता शर्मा (पोखरा ब्युरो)">सुनिता शर्मा (पोखरा ब्युरो)</option>
                  <option value="रमेश अधिकारी (प्रमुख सम्पादक)">रमेश अधिकारी (प्रमुख सम्पादक)</option>
                  <option value="बिमल कार्की (संस्कृति डेस्क)">बिमल कार्की (संस्कृति डेस्क)</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
                <button
                  type="button"
                  onClick={() => setShowNewTaskModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-muted-foreground hover:bg-muted"
                >
                  रद्द गर्नुहोस्
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-primary text-white text-xs font-bold shadow-md hover:bg-primary/90"
                >
                  असाइन गर्नुहोस्
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
