import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { 
  Radio, Play, Pause, Volume2, VolumeX, Sparkles, Clock, Calendar, 
  Share2, ListMusic, Headphones, ShieldCheck, Wifi, RefreshCw, ChevronRight,
  Bookmark, Mic, Tag, Layers, Info, Award, MapPin, AlertTriangle, Activity, CheckCircle2
} from "lucide-react";
import { useMediaOS } from "@/src/context/MediaOSContext";
import { useLanguage } from "@/src/context/LanguageContext";
import { RadioEngine, DEFAULT_RADIO_STATION, DEFAULT_RADIO_BRANDING } from "@/src/services/radioEngine";
import type { 
  RadioSnapshotData, 
  RadioStation, 
  RadioProgram, 
  RadioScheduleSlot, 
  RadioBroadcast, 
  RadioBulletin,
  RadioBreakingAlert
} from "@/src/types/radio";
import Header from "@/src/components/layout/Header";
import Footer from "@/src/components/layout/Footer";
import { toast } from "sonner";

import { useConnectivity } from "@/src/lib/connectivity";

export default function RadioPage() {
  const { language } = useLanguage();
  const isNe = language === "ne";
  const isOnline = useConnectivity();

  const {
    currentTrack,
    isPlaying,
    togglePlay,
    volume,
    setVolume,
    isMuted,
    toggleMute,
    queue,
    playQueue,
    enqueueArticle,
    playArticle,
    clearQueue
  } = useMediaOS();

  const [snapshot, setSnapshot] = useState<RadioSnapshotData | null>(null);
  const [activeTab, setActiveTab] = useState<"now_playing" | "live" | "programs" | "news" | "podcasts" | "schedule" | "queue">("now_playing");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedDistrict, setSelectedDistrict] = useState<string>("all");
  const [loading, setLoading] = useState<boolean>(true);
  const [generatingIntro, setGeneratingIntro] = useState<boolean>(false);
  const [selectedDay, setSelectedDay] = useState<number>(new Date().getDay());

  // Real Broadcast Clock ticker
  const [clock, setClock] = useState(RadioEngine.getBroadcastClock());

  useEffect(() => {
    const timer = setInterval(() => {
      setClock(RadioEngine.getBroadcastClock());
    }, 1000);

    return () => {
      clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    let isMounted = true;
    const loadRadioData = async () => {
      setLoading(true);
      try {
        const data = await RadioEngine.fetchSnapshot();
        if (isMounted) setSnapshot(data);
      } catch (err) {
        console.warn("[RadioPage] Failed to load radio snapshot:", err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    loadRadioData();
    return () => { isMounted = false; };
  }, []);

  // Ping listener heartbeat
  useEffect(() => {
    if (isPlaying) {
      const ping = setInterval(() => {
        fetch("/api/radio/heartbeat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ district: selectedDistrict })
        }).catch(() => {});
      }, 30000);
      return () => clearInterval(ping);
    }
  }, [isPlaying, selectedDistrict]);

  const station: RadioStation = snapshot?.station || DEFAULT_RADIO_STATION;
  const programs: RadioProgram[] = snapshot?.programs || [];
  const schedule: RadioScheduleSlot[] = snapshot?.schedule || [];
  const bulletins: RadioBulletin[] = snapshot?.bulletins || [];
  const breakingAlerts: RadioBreakingAlert[] = snapshot?.breakingAlerts || [];
  const branding = snapshot?.soundBranding || DEFAULT_RADIO_BRANDING;

  // Resolve currently active program & live broadcast clock metadata
  const { slot: activeSlot, program: activeProgram, progressPercent, remainingMinutes } = RadioEngine.getCurrentProgramSlot(schedule, programs);
  const { nextSlot, nextProgram, startsInMinutes } = RadioEngine.getNextProgramSlot(schedule, programs);

  // Check if radio stream is currently playing in MediaOSContext
  const isRadioActive = currentTrack?.id === `radio-station-${station.id}`;

  const handlePlayStationStream = () => {
    const trackItem = RadioEngine.stationToPlaylistItem(
      station, 
      activeProgram ? (isNe ? activeProgram.titleNe : activeProgram.titleEn) : undefined
    );
    if (isRadioActive) {
      togglePlay();
    } else {
      playQueue([trackItem as any], `🎙️ ${station.nameNe} Live Radio`);
    }
  };

  const handlePlayProgramEpisode = (prog: RadioProgram) => {
    const item = {
      id: `radio-prog-${prog.id}`,
      articleId: prog.id,
      title: isNe ? prog.titleNe : prog.titleEn,
      category: prog.category,
      imageUrl: prog.coverImageUrl || "https://images.unsplash.com/photo-1590602847861-f357a9332bbc?w=800&auto=format&fit=crop",
      contentSummary: isNe ? prog.descriptionNe : prog.descriptionEn,
      duration: (prog.durationMinutes || 30) * 60,
      audioUrl: station.liveStreamUrl,
      addedAt: new Date().toISOString(),
      slug: prog.slug
    };
    playQueue([item as any], `🎙️ ${isNe ? prog.titleNe : prog.titleEn}`);
  };

  const handlePlayStationIntro = async () => {
    setGeneratingIntro(true);
    try {
      const introText = isNe ? station.stationIntroNe : station.stationIntroEn;
      const res = await fetch("/api/radio/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: introText,
          voice: snapshot?.settings?.ttsVoiceNe || "Aoede",
          title: "Station Identification"
        })
      });

      if (!res.ok) throw new Error("Station intro generation failed");
      const data = await res.json();
      if (data.success && data.audioBase64) {
        const audioUrl = `data:${data.mimeType || "audio/wav"};base64,${data.audioBase64}`;
        const item = {
          id: `radio-intro-${Date.now()}`,
          articleId: "station-intro",
          title: isNe ? "सनातन रेडियो - स्टेशन पहिचान" : "Sanatan Radio - Station Identification",
          category: "Station ID",
          imageUrl: "https://images.unsplash.com/photo-1590602847861-f357a9332bbc?w=800&auto=format&fit=crop",
          contentSummary: introText || "",
          audioUrl: audioUrl,
          addedAt: new Date().toISOString()
        };
        playQueue([item as any], isNe ? "रेडियो पहिचान" : "Station Intro");
      }
    } catch (err: any) {
      toast.error(isNe ? "रेडियो पहिचान वाचन सुरु हुन सकेन।" : "Failed to play station intro.");
    } finally {
      setGeneratingIntro(false);
    }
  };

  const handleShareStation = () => {
    if (navigator.share) {
      navigator.share({
        title: station.nameNe,
        text: station.taglineNe,
        url: window.location.href
      }).catch(() => {});
    } else {
      navigator.clipboard.writeText(window.location.href);
      toast.success(isNe ? "रेडियो लिङ्क कपी भयो।" : "Radio link copied to clipboard.");
    }
  };

  const districtFeeds = [
    { id: "all", nameNe: "सबै जिल्ला (राष्ट्रिय)", nameEn: "All Districts (National)" },
    { id: "kathmandu", nameNe: "काठमाडौँ उपत्यका", nameEn: "Kathmandu Valley" },
    { id: "pokhara", nameNe: "पोखरा गण्डकी", nameEn: "Pokhara Gandaki" },
    { id: "janakpur", nameNe: "जनकपुरधाम मधेश", nameEn: "Janakpurdham Madhesh" },
    { id: "karnali", nameNe: "कर्णाली प्रदेश", nameEn: "Karnali Province" },
    { id: "chitwan", nameNe: "चितवन नारायणी", nameEn: "Chitwan Narayani" }
  ];

  const filteredPrograms = selectedCategory === "all"
    ? programs
    : programs.filter(p => p.category === selectedCategory);

  const filteredBulletins = selectedDistrict === "all"
    ? bulletins
    : bulletins.filter(b => !b.district || b.district === selectedDistrict);

  const dayNamesNe = ["आइतबार", "सोमबार", "मङ्गलबार", "बुधबार", "बिहीबार", "शुक्रबार", "शनिबार"];
  const dayNamesEn = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

  return (
    <div className="min-h-screen bg-background text-card-foreground flex flex-col selection:bg-amber-500/20">
      <Header />

      <main className="flex-1 container-custom py-6 px-4 md:px-6 space-y-8">
        
        {/* TOP BRANDING BAR & BROADCAST CLOCK */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-border pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-500 border border-amber-500/20 shadow-sm">
              <Radio size={26} className="animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl md:text-2xl font-bold tracking-tight text-foreground font-display">
                  {isNe ? station.nameNe : station.nameEn}
                </h1>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold tracking-widest uppercase bg-rose-500/10 text-rose-500 border border-rose-500/20 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-ping" />
                  {isNe ? "प्रत्यक्ष (LIVE)" : "LIVE"}
                </span>
                {!isOnline && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-500 border border-amber-500/20">
                    {isNe ? "अफलाइन रेडियो मोड" : "Offline Radio OS"}
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                {isNe ? station.taglineNe : station.taglineEn}
              </p>
            </div>
          </div>

          {/* REAL BROADCAST CLOCK WIDGET */}
          <div className="flex items-center gap-3 self-end sm:self-auto bg-card border border-border px-3.5 py-1.5 rounded-xl shadow-sm">
            <Clock size={16} className="text-amber-500 animate-pulse" />
            <div className="text-right font-mono">
              <div className="text-xs font-bold text-foreground">
                {isNe ? clock.timeStrNe : clock.timeStr12}
              </div>
              <div className="text-[10px] text-muted-foreground">
                {isNe ? `${clock.dayNameNe}, ${clock.dateStrNe}` : `${clock.dayNameEn}, ${clock.dateStrEn}`}
              </div>
            </div>
          </div>
        </div>

        {/* DISTRICT FEEDS HUB SELECTOR */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar bg-accent/30 p-1.5 rounded-xl border border-border">
          <div className="flex items-center gap-1.5 px-3 py-1 text-xs font-bold text-amber-500 whitespace-nowrap">
            <MapPin size={14} />
            <span>{isNe ? "जिल्ला रेडियो फिड:" : "District Radio Feed:"}</span>
          </div>
          {districtFeeds.map(d => (
            <button
              key={d.id}
              onClick={() => setSelectedDistrict(d.id)}
              className={`px-3 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                selectedDistrict === d.id
                  ? "bg-amber-500 text-slate-950 font-bold shadow-sm"
                  : "bg-background/80 hover:bg-background text-muted-foreground"
              }`}
            >
              {isNe ? d.nameNe : d.nameEn}
            </button>
          ))}
        </div>

        {/* HERO BROADCAST DESK */}
        <div className="relative rounded-2xl bg-gradient-to-br from-card via-card/90 to-amber-950/20 border border-amber-500/20 p-6 md:p-8 shadow-xl overflow-hidden">
          <div className="absolute -top-24 -right-24 w-96 h-96 rounded-full bg-amber-500/5 blur-3xl pointer-events-none" />

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center relative z-10">
            
            {/* LEFT: STATION & LIVE PROGRAM METADATA */}
            <div className="lg:col-span-7 space-y-4">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                <Mic size={14} />
                <span>
                  {activeProgram 
                    ? (isNe ? `हालको कार्यक्रम: ${activeProgram.titleNe}` : `Now On Air: ${activeProgram.titleEn}`)
                    : (isNe ? "सनातन डिजिटल रेडियो २४/७" : "Sanatan Digital Radio 24/7")}
                </span>
              </div>

              <h2 className="text-2xl md:text-3xl lg:text-4xl font-extrabold text-foreground tracking-tight leading-tight">
                {activeProgram ? (isNe ? activeProgram.titleNe : activeProgram.titleEn) : (isNe ? station.nameNe : station.nameEn)}
              </h2>

              <p className="text-sm md:text-base text-muted-foreground line-clamp-2 max-w-2xl leading-relaxed">
                {activeProgram 
                  ? (isNe ? activeProgram.descriptionNe : activeProgram.descriptionEn) 
                  : (isNe ? station.taglineNe : station.taglineEn)}
              </p>

              {/* LIVE PROGRAM PROGRESS BAR & CLOCK REMAINING */}
              {activeSlot && (
                <div className="space-y-1.5 pt-2 max-w-lg">
                  <div className="flex items-center justify-between text-xs font-mono text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                      <Clock size={12} className="text-amber-500" />
                      {activeSlot.startTime} - {activeSlot.endTime}
                    </span>
                    <span className="text-amber-500 font-bold">
                      {isNe ? `${remainingMinutes} मिनेट बाँकी` : `${remainingMinutes}m remaining`}
                    </span>
                  </div>
                  <div className="w-full bg-accent/80 h-2 rounded-full overflow-hidden border border-border/50">
                    <div 
                      className="bg-amber-500 h-full rounded-full transition-all duration-1000 ease-linear shadow-sm"
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>
                </div>
              )}

              {activeProgram?.hostNameNe && (
                <div className="flex items-center gap-4 text-xs text-muted-foreground pt-1">
                  <span className="flex items-center gap-1.5 font-medium text-foreground">
                    <Award size={14} className="text-amber-500" />
                    {isNe ? `उद्घोषक: ${activeProgram.hostNameNe}` : `Host: ${activeProgram.hostNameEn || activeProgram.hostNameNe}`}
                  </span>
                </div>
              )}

              {/* REVENUEOS SPONSORSHIP DISCLOSURE BANNER */}
              {activeProgram?.sponsorInfo?.sponsorNameNe && (
                <div className="mt-3 inline-flex items-center gap-2 text-xs px-3 py-1.5 rounded-md bg-accent/60 border border-border text-muted-foreground">
                  <ShieldCheck size={14} className="text-emerald-500" />
                  <span>
                    {isNe ? `प्रायोजित रेडियो साझेदार: ${activeProgram.sponsorInfo.sponsorNameNe}` : `Sponsored Broadcast Partner: ${activeProgram.sponsorInfo.sponsorNameEn || activeProgram.sponsorInfo.sponsorNameNe}`}
                  </span>
                </div>
              )}
            </div>

            {/* RIGHT: CONTROLS & MAIN PLAYER */}
            <div className="lg:col-span-5 flex flex-col items-center lg:items-end justify-center space-y-5">
              
              <div className="flex items-center gap-4">
                <button
                  onClick={handlePlayStationIntro}
                  disabled={generatingIntro}
                  className="px-3.5 py-2 rounded-xl border border-amber-500/30 hover:border-amber-500 bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 text-xs font-semibold transition-all flex items-center gap-2 shadow-sm disabled:opacity-50"
                  title={isNe ? "रेडियो पहिचान सुन्नुहोस्" : "Play Station Identification"}
                >
                  <Sparkles size={14} className={generatingIntro ? "animate-spin" : ""} />
                  <span>{generatingIntro ? (isNe ? "वाचन हुँदैछ..." : "Loading Intro...") : (isNe ? "रेडियो पहिचान" : "Station Intro")}</span>
                </button>

                <button
                  onClick={handleShareStation}
                  className="p-2.5 rounded-xl border border-border hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                  title={isNe ? "रेडियो सेयर गर्नुहोस्" : "Share Radio"}
                >
                  <Share2 size={18} />
                </button>
              </div>

              {/* MAIN LARGE PLAY BUTTON */}
              <div className="flex items-center gap-4">
                <button
                  onClick={handlePlayStationStream}
                  className="w-20 h-20 rounded-2xl bg-amber-500 hover:bg-amber-600 active:scale-95 text-slate-950 shadow-lg shadow-amber-500/25 flex items-center justify-center transition-all group"
                  aria-label={isPlaying && isRadioActive ? "Pause Radio" : "Play Radio"}
                >
                  {isPlaying && isRadioActive ? (
                    <Pause size={36} className="fill-slate-950" />
                  ) : (
                    <Play size={36} className="fill-slate-950 ml-1 group-hover:scale-110 transition-transform" />
                  )}
                </button>

                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={toggleMute}
                      className="p-1.5 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {isMuted || volume === 0 ? <VolumeX size={18} /> : <Volume2 size={18} />}
                    </button>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.05"
                      value={isMuted ? 0 : volume}
                      onChange={(e) => setVolume(parseFloat(e.target.value))}
                      className="w-28 accent-amber-500 cursor-pointer h-1.5 bg-accent rounded-lg"
                    />
                  </div>

                  <div className="flex items-center gap-2 text-[11px] text-muted-foreground font-mono">
                    <Wifi size={12} className="text-emerald-500" />
                    <span>ZenoFM Live HD 128kbps</span>
                  </div>
                </div>
              </div>

            </div>

          </div>
        </div>

        {/* UP NEXT BROADCAST DESK PREVIEW BANNER */}
        {nextSlot && (
          <div className="p-4 rounded-xl border border-border bg-card/60 flex items-center justify-between gap-4 text-xs">
            <div className="flex items-center gap-3">
              <span className="font-bold uppercase px-2 py-0.5 rounded bg-amber-500/10 text-amber-500 border border-amber-500/20">
                {isNe ? "अर्को कार्यक्रम" : "Up Next"}
              </span>
              <span className="font-bold text-foreground">
                {isNe ? nextSlot.programTitleNe : nextSlot.programTitleEn}
              </span>
              <span className="text-muted-foreground font-mono">({nextSlot.startTime})</span>
            </div>
            <span className="text-amber-500 font-bold font-mono">
              {isNe ? `${startsInMinutes} मिनेट पछि सुरु हुनेछ` : `Starts in ${startsInMinutes} mins`}
            </span>
          </div>
        )}

        {/* NAVIGATION TABS */}
        <div className="border-b border-border overflow-x-auto no-scrollbar">
          <nav className="flex space-x-6 min-w-max">
            {[
              { id: "now_playing", labelNe: "हाल बजिरहेको", labelEn: "Now Playing", icon: Radio },
              { id: "live", labelNe: "लाइभ स्ट्रिमहरू", labelEn: "Live Streams", icon: Wifi },
              { id: "programs", labelNe: "कार्यक्रमहरू", labelEn: "Programs", icon: Mic },
              { id: "news", labelNe: "श्रव्य समाचार", labelEn: "News Bulletins", icon: Layers },
              { id: "podcasts", labelNe: "पोडकास्टहरू", labelEn: "Podcasts", icon: Headphones },
              { id: "schedule", labelNe: "साप्ताहिक तालिका", labelEn: "Schedule", icon: Calendar },
              { id: "queue", labelNe: "लाइन (Queue)", labelEn: "Queue", icon: ListMusic },
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`pb-3 text-sm font-semibold flex items-center gap-2 transition-colors relative border-b-2 ${
                    isActive
                      ? "border-amber-500 text-amber-500"
                      : "border-transparent text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Icon size={16} />
                  <span>{isNe ? tab.labelNe : tab.labelEn}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* TAB 1: NOW PLAYING */}
        {activeTab === "now_playing" && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-8 space-y-6">
              
              {/* CURRENT BROADCAST CARD */}
              <div className="p-6 rounded-xl border border-border bg-card space-y-4 shadow-sm">
                <div className="flex items-center justify-between border-b border-border pb-3">
                  <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                    <Radio size={18} className="text-amber-500" />
                    <span>{isNe ? "हालको रेडियो प्रसारण" : "Active Broadcast Session"}</span>
                  </h3>
                  <span className="text-xs px-2.5 py-1 rounded-full font-bold bg-amber-500/10 text-amber-500 border border-amber-500/20">
                    {station.isLiveBroadcasting ? (isNe ? "लाइभ (LIVE)" : "LIVE") : (isNe ? "अभिलेख (RECORDED)" : "RECORDED")}
                  </span>
                </div>

                <div className="space-y-2">
                  <h4 className="text-xl font-bold text-foreground">
                    {activeProgram ? (isNe ? activeProgram.titleNe : activeProgram.titleEn) : (isNe ? station.nameNe : station.nameEn)}
                  </h4>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {activeProgram ? (isNe ? activeProgram.descriptionNe : activeProgram.descriptionEn) : (isNe ? station.taglineNe : station.taglineEn)}
                  </p>
                </div>

                <div className="flex items-center justify-between pt-2">
                  <button
                    onClick={handlePlayStationStream}
                    className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs flex items-center gap-2 transition-colors"
                  >
                    {isPlaying && isRadioActive ? <Pause size={16} /> : <Play size={16} />}
                    <span>{isPlaying && isRadioActive ? (isNe ? "रोक्नुहोस्" : "Pause") : (isNe ? "सुन्नुहोस्" : "Listen Now")}</span>
                  </button>

                  <button
                    onClick={handlePlayStationIntro}
                    className="text-xs text-amber-500 hover:underline flex items-center gap-1 font-medium"
                  >
                    <Sparkles size={14} />
                    <span>{isNe ? "स्टेशन पहिचान बजाउनुहोस्" : "Play Station ID"}</span>
                  </button>
                </div>
              </div>

              {/* UP NEXT TIMELINE */}
              <div className="p-6 rounded-xl border border-border bg-card space-y-4">
                <h3 className="text-base font-bold text-foreground flex items-center gap-2 border-b border-border pb-3">
                  <Clock size={18} className="text-amber-500" />
                  <span>{isNe ? "आजका आगामी कार्यक्रमहरू" : "Up Next Today"}</span>
                </h3>

                <div className="space-y-3">
                  {schedule.slice(0, 4).map((slot) => (
                    <div key={slot.id} className="p-3 rounded-lg bg-accent/40 border border-border/50 flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-mono font-bold px-2 py-1 rounded bg-background border border-border text-foreground">
                          {slot.startTime} - {slot.endTime}
                        </span>
                        <div>
                          <div className="text-sm font-bold text-foreground">
                            {isNe ? slot.programTitleNe : slot.programTitleEn}
                          </div>
                          {slot.hostNameNe && (
                            <div className="text-xs text-muted-foreground">
                              {isNe ? `उद्घोषक: ${slot.hostNameNe}` : `Host: ${slot.hostNameEn || slot.hostNameNe}`}
                            </div>
                          )}
                        </div>
                      </div>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded border uppercase ${
                        slot.broadcastType === "LIVE" ? "bg-rose-500/10 text-rose-500 border-rose-500/20" : "bg-amber-500/10 text-amber-500 border-amber-500/20"
                      }`}>
                        {slot.broadcastType}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

            </div>

            {/* RIGHT SIDEBAR: FEATURED PROGRAMS */}
            <div className="lg:col-span-4 space-y-6">
              <div className="p-6 rounded-xl border border-border bg-card space-y-4">
                <h3 className="text-base font-bold text-foreground flex items-center gap-2 border-b border-border pb-3">
                  <Mic size={18} className="text-amber-500" />
                  <span>{isNe ? "प्रमुख कार्यक्रमहरू" : "Featured Programs"}</span>
                </h3>

                <div className="space-y-4">
                  {programs.filter(p => p.isFeatured).slice(0, 3).map((prog) => (
                    <div key={prog.id} className="group p-3 rounded-xl border border-border/60 bg-accent/20 hover:bg-accent/50 transition-colors space-y-2">
                      <div className="text-sm font-bold text-foreground group-hover:text-amber-500 transition-colors">
                        {isNe ? prog.titleNe : prog.titleEn}
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-2">
                        {isNe ? prog.descriptionNe : prog.descriptionEn}
                      </p>
                      <div className="flex items-center justify-between pt-1">
                        <span className="text-[11px] text-amber-600 dark:text-amber-400 font-medium">
                          {prog.scheduleMetadata}
                        </span>
                        <button
                          onClick={() => handlePlayProgramEpisode(prog)}
                          className="p-1.5 rounded-lg bg-amber-500/10 text-amber-500 hover:bg-amber-500 hover:text-slate-950 transition-colors"
                          title={isNe ? "कार्यक्रम बजाउनुहोस्" : "Play Program"}
                        >
                          <Play size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: LIVE STREAMS */}
        {activeTab === "live" && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <div className="p-6 rounded-xl border border-amber-500/30 bg-card space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                    {isNe ? "मुख्य च्यानल (High Def)" : "Main Channel"}
                  </span>
                  <Wifi size={18} className="text-emerald-500" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-foreground">{isNe ? station.nameNe : station.nameEn}</h3>
                  <p className="text-xs text-muted-foreground mt-1">{isNe ? station.taglineNe : station.taglineEn}</p>
                </div>
                <div className="text-xs font-mono text-muted-foreground">MP3 / AAC Stream (128 kbps)</div>
                <button
                  onClick={handlePlayStationStream}
                  className="w-full py-2.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs flex items-center justify-center gap-2 transition-colors"
                >
                  {isPlaying && isRadioActive ? <Pause size={16} /> : <Play size={16} />}
                  <span>{isPlaying && isRadioActive ? (isNe ? "रोक्नुहोस्" : "Pause Stream") : (isNe ? "मुख्य च्यानल सुन्नुहोस्" : "Listen Main Stream")}</span>
                </button>
              </div>

              <div className="p-6 rounded-xl border border-border bg-card space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-500 border border-amber-500/20">
                    {isNe ? "कम ब्यान्डविथ (Low Data)" : "Low Data Stream"}
                  </span>
                  <Wifi size={18} className="text-amber-500" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-foreground">{isNe ? `${station.nameNe} (६४ kbps)` : `${station.nameEn} (64 kbps)`}</h3>
                  <p className="text-xs text-muted-foreground mt-1">{isNe ? "सुस्त इन्टरनेटका लागि उपयुक्त कम डेटा खपत हुने च्यानल।" : "Optimized for mobile & low connectivity zones."}</p>
                </div>
                <div className="text-xs font-mono text-muted-foreground">AAC-LC Stream (64 kbps)</div>
                <button
                  onClick={handlePlayStationStream}
                  className="w-full py-2.5 rounded-lg border border-border hover:bg-accent text-foreground font-bold text-xs flex items-center justify-center gap-2 transition-colors"
                >
                  <Play size={16} />
                  <span>{isNe ? "कम डेटा च्यानल बजाउनुहोस्" : "Play Low-Data Stream"}</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: PROGRAMS CATALOG */}
        {activeTab === "programs" && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center gap-2">
              {["all", "संस्कृति र समाचार", "राष्ट्रिय समाचार", "दर्शन र विचार", "साहित्य र कला"].map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                    selectedCategory === cat
                      ? "bg-amber-500 text-slate-950"
                      : "bg-accent border border-border text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {cat === "all" ? (isNe ? "सबै विधाहरू" : "All Categories") : cat}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredPrograms.map((prog) => (
                <div key={prog.id} className="p-6 rounded-xl border border-border bg-card space-y-4 hover:border-amber-500/40 transition-colors flex flex-col justify-between">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold px-2.5 py-0.5 rounded bg-accent text-amber-500 border border-border">
                        {prog.category}
                      </span>
                      {prog.isFeatured && (
                        <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-amber-500/10 text-amber-500">
                          {isNe ? "प्रमुख" : "Featured"}
                        </span>
                      )}
                    </div>

                    <h3 className="text-lg font-bold text-foreground">{isNe ? prog.titleNe : prog.titleEn}</h3>
                    <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3">
                      {isNe ? prog.descriptionNe : prog.descriptionEn}
                    </p>
                  </div>

                  <div className="space-y-3 pt-3 border-t border-border">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>{isNe ? `उद्घोषक: ${prog.hostNameNe}` : `Host: ${prog.hostNameEn || prog.hostNameNe}`}</span>
                      <span className="font-mono">{prog.durationMinutes || 30}m</span>
                    </div>

                    <button
                      onClick={() => handlePlayProgramEpisode(prog)}
                      className="w-full py-2 rounded-lg bg-amber-500/10 hover:bg-amber-500 text-amber-500 hover:text-slate-950 font-bold text-xs flex items-center justify-center gap-2 transition-colors"
                    >
                      <Play size={14} />
                      <span>{isNe ? "कार्यक्रम सुन्नुहोस्" : "Listen Program"}</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 4: NEWS BULLETINS */}
        {activeTab === "news" && (
          <div className="space-y-6">
            <div className="p-6 rounded-xl border border-border bg-card space-y-4">
              <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                <Layers size={18} className="text-amber-500" />
                <span>{isNe ? "प्रमाणित समाचार बुलेटिनहरू" : "Verified Radio Bulletins"}</span>
              </h3>
              <p className="text-xs text-muted-foreground">
                {isNe 
                  ? "सनातन मार्गका प्रमाणित पत्रकारहरूद्वारा तयार पारिएका राष्ट्रिय तथा क्षेत्रीय समाचार बुलेटिनहरू।" 
                  : "Editorial bulletins generated strictly from verified SanatanMarga news coverage."}
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                {filteredBulletins.length > 0 ? (
                  filteredBulletins.map((bul) => (
                    <div key={bul.id} className="p-4 rounded-lg border border-border bg-accent/20 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="text-sm font-bold text-foreground">{isNe ? bul.titleNe : bul.titleEn}</div>
                        <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-500">
                          {bul.status === "published" ? (isNe ? "स्वीकृत" : "Approved") : "Draft"}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-2">{isNe ? bul.scriptNe : bul.scriptEn}</p>
                      <div className="flex items-center justify-between text-xs pt-2 border-t border-border/40">
                        <span className="text-amber-500 font-medium">{bul.district || "राष्ट्रिय"}</span>
                        <button
                          onClick={() => playArticle({ id: bul.id, title: bul.titleNe, summary: bul.scriptNe, audioUrl: bul.audioUrl } as any)}
                          className="px-3 py-1 rounded bg-amber-500 text-slate-950 font-bold text-xs flex items-center gap-1"
                        >
                          <Play size={12} />
                          <span>{isNe ? "बुलेटिन सुन्नुहोस्" : "Play Bulletin"}</span>
                        </button>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="col-span-full py-8 text-center text-xs text-muted-foreground bg-accent/20 rounded-lg border border-dashed border-border">
                    {isNe ? "रेडियो बुलेटिनका लागि प्रमाणित समाचार उपलब्ध छैन।" : "No verified stories are currently available for the radio bulletin."}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* TAB 5: PODCASTS */}
        {activeTab === "podcasts" && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {programs.slice(0, 3).map((prog) => (
                <div key={prog.id} className="p-6 rounded-xl border border-border bg-card space-y-4">
                  <div className="w-12 h-12 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center border border-amber-500/20">
                    <Headphones size={24} />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-foreground">{isNe ? prog.titleNe : prog.titleEn}</h3>
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{isNe ? prog.descriptionNe : prog.descriptionEn}</p>
                  </div>
                  <button
                    onClick={() => handlePlayProgramEpisode(prog)}
                    className="w-full py-2 rounded-lg border border-amber-500/30 text-amber-500 hover:bg-amber-500 hover:text-slate-950 font-bold text-xs flex items-center justify-center gap-2 transition-colors"
                  >
                    <Play size={14} />
                    <span>{isNe ? "पोडकास्ट एपिसोड सुन्नुहोस्" : "Listen Episode"}</span>
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 6: SCHEDULE */}
        {activeTab === "schedule" && (
          <div className="space-y-6">
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-2">
              {[0, 1, 2, 3, 4, 5, 6].map((dayIdx) => (
                <button
                  key={dayIdx}
                  onClick={() => setSelectedDay(dayIdx)}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                    selectedDay === dayIdx
                      ? "bg-amber-500 text-slate-950 shadow-md"
                      : "bg-card border border-border text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {isNe ? dayNamesNe[dayIdx] : dayNamesEn[dayIdx]}
                </button>
              ))}
            </div>

            <div className="p-6 rounded-xl border border-border bg-card space-y-4">
              <h3 className="text-base font-bold text-foreground flex items-center gap-2 border-b border-border pb-3">
                <Calendar size={18} className="text-amber-500" />
                <span>
                  {isNe ? `${dayNamesNe[selectedDay]}को रेडियो तालिका` : `${dayNamesEn[selectedDay]} Schedule`}
                </span>
              </h3>

              <div className="space-y-3">
                {schedule
                  .filter(slot => slot.dayOfWeek === selectedDay || slot.dayOfWeek === -1)
                  .map((slot) => (
                    <div key={slot.id} className="p-4 rounded-xl bg-accent/30 border border-border/60 flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div className="flex items-start md:items-center gap-4">
                        <span className="text-sm font-mono font-bold px-3 py-1.5 rounded-lg bg-background border border-border text-amber-500 min-w-[120px] text-center">
                          {slot.startTime} - {slot.endTime}
                        </span>
                        <div>
                          <div className="text-sm font-bold text-foreground">{isNe ? slot.programTitleNe : slot.programTitleEn}</div>
                          {slot.hostNameNe && (
                            <div className="text-xs text-muted-foreground">
                              {isNe ? `उद्घोषक: ${slot.hostNameNe}` : `Host: ${slot.hostNameEn || slot.hostNameNe}`}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-3 self-end md:self-auto">
                        <span className={`text-[10px] font-bold px-2.5 py-1 rounded border uppercase ${
                          slot.broadcastType === "LIVE" ? "bg-rose-500/10 text-rose-500 border-rose-500/20" : "bg-amber-500/10 text-amber-500 border-amber-500/20"
                        }`}>
                          {slot.broadcastType}
                        </span>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        )}

        {/* TAB 7: QUEUE */}
        {activeTab === "queue" && (
          <div className="p-6 rounded-xl border border-border bg-card space-y-6">
            <div className="flex items-center justify-between border-b border-border pb-4">
              <div>
                <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                  <ListMusic size={18} className="text-amber-500" />
                  <span>{isNe ? "रेडियो तथा श्रव्य लाइन (Play Queue)" : "Radio Playback Queue"}</span>
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {isNe ? `जम्मा ${queue.length} वटा सामग्री` : `${queue.length} items in queue`}
                </p>
              </div>

              {queue.length > 0 && (
                <button
                  onClick={clearQueue}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium border border-rose-500/20 text-rose-500 hover:bg-rose-500/10 transition-colors"
                >
                  {isNe ? "लाइन खाली गर्नुहोस्" : "Clear Queue"}
                </button>
              )}
            </div>

            {queue.length > 0 ? (
              <div className="space-y-3">
                {queue.map((item, idx) => (
                  <div key={item.id} className="p-3 rounded-lg bg-accent/20 border border-border flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-mono font-bold text-muted-foreground w-6 text-center">
                        {idx + 1}
                      </span>
                      <div>
                        <div className="text-sm font-bold text-foreground">{item.title}</div>
                        <div className="text-xs text-muted-foreground">{item.category}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-12 text-center text-xs text-muted-foreground">
                {isNe ? "हाल लाइनमा कुनै सामग्री छैन।" : "Queue is currently empty."}
              </div>
            )}
          </div>
        )}

      </main>

      <Footer />
    </div>
  );
}
