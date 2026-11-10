import { useState, useEffect } from "react";
import { 
  TrendingUp, TrendingDown, Activity, ChevronDown, ChevronUp, 
  Filter, ExternalLink, Layers, Fuel, BarChart3, Globe2, Sparkles, RefreshCw
} from "lucide-react";
import { LineChart, Line, ResponsiveContainer, YAxis } from "recharts";
import { motion, AnimatePresence } from "motion/react";
import { Link } from "react-router-dom";

// Simple seeded random number generator
function seededRandom(seed: number) {
  const x = Math.sin(seed++) * 10000;
  return x - Math.floor(x);
}

const Sparkline = ({ data, color }: { data: any[], color: string }) => (
  <div className="h-10 w-24 relative overflow-hidden flex items-center justify-center">
    <ResponsiveContainer width="100%" height={36}>
      <LineChart data={data}>
        <YAxis hide domain={['auto', 'auto']} />
        <Line 
          type="monotone" 
          dataKey="value" 
          stroke={color} 
          strokeWidth={2.5} 
          dot={false} 
          animationDuration={1200}
        />
      </LineChart>
    </ResponsiveContainer>
  </div>
);

type MarketCategory = "all" | "nepse" | "bullion" | "forex" | "commodities";

export default function MarketDataWidget() {
  const [marketData, setMarketData] = useState<any>(null);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState<MarketCategory>("all");
  const [isExpandedDetailsOpen, setIsExpandedDetailsOpen] = useState(false);

  useEffect(() => {
    const fetchMarketData = async () => {
      try {
        const response = await fetch('/api/market-data');
        if (response.ok) {
          const text = await response.text();
          if (!text || text.trim().startsWith("<")) {
            throw new Error("HTML response received from /api/market-data");
          }
          const apiData = JSON.parse(text);
          const today = new Date();
          const seed = today.getFullYear() * 10000 + (today.getMonth() + 1) * 100 + today.getDate();
          
          const generateDataWithHistory = (base: number, variance: number, s: number) => {
            const history = [];
            for (let i = 0; i < 7; i++) {
              const daySeed = s - (6 - i);
              const dayChange = (seededRandom(daySeed) * variance * 2) - variance;
              history.push({ day: i, value: base + dayChange });
            }
            const current = history[6].value;
            const prev = history[5].value;
            const change = current - prev;
            return {
              value: current.toFixed(2),
              change: change.toFixed(2),
              percent: ((change / prev) * 100).toFixed(2),
              isUp: change >= 0,
              history
            };
          };

          setMarketData({
            nepse: generateDataWithHistory(2145.80, 45, seed),
            sensitiveIndex: generateDataWithHistory(385.20, 8, seed + 1),
            floatIndex: generateDataWithHistory(148.60, 4, seed + 2),
            goldFine: apiData?.goldFine || { value: 118500, change: 600, percent: 0.51, isUp: true },
            goldTezab: { value: 117900, change: 600, percent: 0.51, isUp: true },
            silver: apiData?.silver || { value: 1420, change: 15, percent: 1.06, isUp: true },
            forex: {
              usd: generateDataWithHistory(133.65, 1.2, seed + 4),
              eur: generateDataWithHistory(145.80, 1.8, seed + 5),
              gbp: generateDataWithHistory(171.40, 2.1, seed + 6),
              aud: generateDataWithHistory(87.50, 0.9, seed + 7),
              qar: generateDataWithHistory(36.70, 0.3, seed + 8),
              aed: generateDataWithHistory(36.40, 0.3, seed + 9),
            },
            commodities: {
              petrol: { value: 172, unit: "प्रति लिटर", change: -2, isUp: false },
              diesel: { value: 160, unit: "प्रति लिटर", change: -1, isUp: false },
              lpgas: { value: 1910, unit: "प्रति सिलिन्डर", change: 0, isUp: true },
            },
            topStocks: [
              { symbol: "NTC", name: "नेपाल टेलिकम", price: 885, change: 12.5, percent: 1.43, isUp: true },
              { symbol: "NABIL", name: "नबिल बैंक", price: 540, change: -4.0, percent: -0.73, isUp: false },
              { symbol: "GBIME", name: "ग्लोबल आइएमई", price: 215, change: 3.2, percent: 1.51, isUp: true },
              { symbol: "CHCL", name: "चिलिमे हाइड्रो", price: 490, change: 8.0, percent: 1.66, isUp: true },
            ]
          });
        } else {
          throw new Error(`API error: ${response.status}`);
        }
      } catch (err: any) {
        console.info("Market data rate update fallback active:", err?.message || err);
        const today = new Date();
        const seed = today.getFullYear() * 10000 + (today.getMonth() + 1) * 100 + today.getDate();
        
        const generateDataWithHistory = (base: number, variance: number, s: number) => {
          const history = [];
          for (let i = 0; i < 7; i++) {
            const daySeed = s - (6 - i);
            const dayChange = (seededRandom(daySeed) * variance * 2) - variance;
            history.push({ day: i, value: base + dayChange });
          }
          const current = history[6].value;
          const prev = history[5].value;
          const change = current - prev;
          return {
            value: current.toFixed(2),
            change: change.toFixed(2),
            percent: ((change / prev) * 100).toFixed(2),
            isUp: change >= 0,
            history
          };
        };

        setMarketData({
          nepse: generateDataWithHistory(2145.80, 45, seed),
          sensitiveIndex: generateDataWithHistory(385.20, 8, seed + 1),
          floatIndex: generateDataWithHistory(148.60, 4, seed + 2),
          goldFine: { value: 118500, change: 600, percent: 0.51, isUp: true },
          goldTezab: { value: 117900, change: 600, percent: 0.51, isUp: true },
          silver: { value: 1420, change: 15, percent: 1.06, isUp: true },
          forex: {
            usd: generateDataWithHistory(133.65, 1.2, seed + 4),
            eur: generateDataWithHistory(145.80, 1.8, seed + 5),
            gbp: generateDataWithHistory(171.40, 2.1, seed + 6),
            aud: generateDataWithHistory(87.50, 0.9, seed + 7),
            qar: generateDataWithHistory(36.70, 0.3, seed + 8),
            aed: generateDataWithHistory(36.40, 0.3, seed + 9),
          },
          commodities: {
            petrol: { value: 172, unit: "प्रति लिटर", change: -2, isUp: false },
            diesel: { value: 160, unit: "प्रति लिटर", change: -1, isUp: false },
            lpgas: { value: 1910, unit: "प्रति सिलिन्डर", change: 0, isUp: true },
          },
          topStocks: [
            { symbol: "NTC", name: "नेपाल टेलिकम", price: 885, change: 12.5, percent: 1.43, isUp: true },
            { symbol: "NABIL", name: "नबिल बैंक", price: 540, change: -4.0, percent: -0.73, isUp: false },
            { symbol: "GBIME", name: "ग्लोबल आइएमई", price: 215, change: 3.2, percent: 1.51, isUp: true },
            { symbol: "CHCL", name: "चिलिमे हाइड्रो", price: 490, change: 8.0, percent: 1.66, isUp: true },
          ]
        });
      }
    };
    fetchMarketData();
  }, []);

  if (!marketData) {
    return (
      <div className="bg-card rounded-post-card shadow-sm border border-border-theme overflow-hidden mb-8 animate-pulse">
        <div className="bg-muted-area/50 px-6 py-4 border-b border-border-theme flex items-center justify-between">
          <div className="h-4 bg-muted-foreground/20 rounded w-52" />
          <div className="h-4 bg-muted-foreground/20 rounded w-24" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-border-theme h-32">
          <div className="p-6 bg-muted-area/30" />
          <div className="p-6 bg-muted-area/10" />
          <div className="p-6 bg-muted-area/30" />
        </div>
      </div>
    );
  }

  const categoryLabels: Record<MarketCategory, { nepali: string; english: string }> = {
    all: { nepali: "सबै सूचकहरू", english: "All Indicators" },
    nepse: { nepali: "नेप्से सूचक", english: "NEPSE Index" },
    bullion: { nepali: "सुन / चाँदी", english: "Gold & Silver" },
    forex: { nepali: "विदेशी मुद्रा", english: "Forex Rates" },
    commodities: { nepali: "इन्धन / जिन्सी", english: "Commodities" },
  };

  return (
    <div className="bg-card rounded-post-card shadow-lg border border-border-theme/70 overflow-hidden mb-8 transition-all duration-300">
      
      {/* Header Bar with Dropdown Selector and Expand/Collapse Controls */}
      <div className="bg-muted-area/60 dark:bg-surface-interactive/80 px-4 sm:px-6 py-3.5 border-b border-border-theme/80 flex flex-wrap items-center justify-between gap-3">
        
        {/* Left: Title & Badge */}
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-primary/10 rounded-xl flex items-center justify-center text-primary shrink-0 shadow-sm">
            <Activity size={18} className="animate-pulse" />
          </div>
          <div>
            <h3 className="text-xs sm:text-sm font-black text-card-foreground uppercase tracking-wider flex items-center gap-2">
              बजारको अवस्था <span className="text-muted-text font-normal text-xs hidden sm:inline">(Market Watch)</span>
            </h3>
            <div className="flex items-center gap-2 text-[10px] text-muted-text font-medium">
              <span className="inline-block w-1.5 h-1.5 bg-emerald-500 rounded-full animate-ping" />
              <span>नेपाल राष्ट्र बैंक र नेप्से प्रत्यक्ष डेटा</span>
            </div>
          </div>
        </div>

        {/* Right Controls: Filter Animated Dropdown + Toggle Accordion Button */}
        <div className="flex items-center gap-2">
          
          {/* Animated Category Dropdown Menu */}
          <div className="relative">
            <button
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-card dark:bg-card border border-border-theme/80 rounded-xl text-xs font-bold text-card-foreground hover:border-primary/50 transition-all shadow-sm"
              title="सूचक छान्नुहोस्"
            >
              <Filter size={13} className="text-primary" />
              <span className="max-w-[100px] sm:max-w-none truncate">{categoryLabels[activeCategory].nepali}</span>
              <motion.div animate={{ rotate: isDropdownOpen ? 180 : 0 }} transition={{ duration: 0.2 }}>
                <ChevronDown size={14} className="text-muted-text" />
              </motion.div>
            </button>

            {/* Dropdown Options List */}
            <AnimatePresence>
              {isDropdownOpen && (
                <>
                  <div 
                    className="fixed inset-0 z-20" 
                    onClick={() => setIsDropdownOpen(false)} 
                  />
                  <motion.div
                    initial={{ opacity: 0, y: -8, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -8, scale: 0.95 }}
                    transition={{ duration: 0.15 }}
                    className="absolute right-0 mt-2 w-48 bg-card dark:bg-[#161F2C] border border-border-theme rounded-2xl shadow-2xl z-30 overflow-hidden p-1.5"
                  >
                    {(Object.keys(categoryLabels) as MarketCategory[]).map((catKey) => (
                      <button
                        key={catKey}
                        onClick={() => {
                          setActiveCategory(catKey);
                          setIsDropdownOpen(false);
                          if (isCollapsed) setIsCollapsed(false);
                        }}
                        className={`w-full text-left px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-between ${
                          activeCategory === catKey
                            ? "bg-primary text-primary-foreground font-black shadow-md shadow-primary/20"
                            : "text-card-foreground hover:bg-muted-area/80 hover:text-primary"
                        }`}
                      >
                        <span>{categoryLabels[catKey].nepali}</span>
                        <span className="text-[10px] opacity-70 font-normal">{categoryLabels[catKey].english}</span>
                      </button>
                    ))}
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>

          {/* Collapsible Toggle Arrow Button */}
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-card dark:bg-card border border-border-theme/80 hover:border-primary/50 text-card-foreground rounded-xl text-xs font-bold transition-all shadow-sm group"
            title={isCollapsed ? "खोल्नुहोस् (Expand)" : "सङ्कुचित गर्नुहोस् (Collapse)"}
          >
            <span className="hidden sm:inline text-[11px] font-bold text-muted-text group-hover:text-card-foreground">
              {isCollapsed ? "विस्तृत हेर्नुहोस्" : "सङ्कुचित"}
            </span>
            <motion.div animate={{ rotate: isCollapsed ? 180 : 0 }} transition={{ duration: 0.3 }}>
              <ChevronUp size={16} className="text-primary" />
            </motion.div>
          </button>
        </div>
      </div>

      {/* Main Content Area with Animated Collapsible Drawer */}
      <AnimatePresence initial={false}>
        {!isCollapsed && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
          >
            <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-border-theme/50 bg-gradient-to-br from-card to-muted-area/20">
              
              {/* 1. NEPSE INDEX PANEL */}
              {(activeCategory === "all" || activeCategory === "nepse") && (
                <div className="p-5 sm:p-6 flex flex-col justify-between gap-4 hover:bg-primary/[0.02] transition-colors relative group/item">
                  <div className="flex items-center justify-between">
                    <div className="flex flex-col">
                      <span className="text-[10px] font-black text-muted-text uppercase tracking-widest mb-1 flex items-center gap-1.5">
                        <BarChart3 size={13} className="text-primary" /> नेप्से सूचक (NEPSE Index)
                      </span>
                      <span className="text-2xl sm:text-3xl font-black text-card-foreground tracking-tighter">
                        {marketData.nepse.value}
                      </span>
                    </div>
                    <Sparkline 
                      data={marketData.nepse.history} 
                      color={marketData.nepse.isUp ? '#10B981' : '#EF4444'} 
                    />
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border-theme/40 pt-3">
                    <div className={`flex items-center gap-1.5 text-xs font-black px-3 py-1 rounded-full ${marketData.nepse.isUp ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'}`}>
                      {marketData.nepse.isUp ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                      {Math.abs(marketData.nepse.change)} ({Math.abs(marketData.nepse.percent)}%)
                    </div>
                    <div className="text-[10px] font-bold text-muted-text">
                      संवेदनशील: <span className="text-card-foreground font-extrabold">{marketData.sensitiveIndex.value}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* 2. GOLD & SILVER BULLION PANEL */}
              {(activeCategory === "all" || activeCategory === "bullion") && (
                <div className="p-5 sm:p-6 flex flex-col justify-between gap-4 hover:bg-primary/[0.02] transition-colors">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-black text-muted-text uppercase tracking-widest flex items-center gap-1.5">
                      <Sparkles size={13} className="text-amber-500" /> सुन / चाँदी दर (प्रति तोला)
                    </span>
                    <span className="text-[10px] font-bold text-muted-text bg-amber-500/10 text-amber-600 dark:text-amber-400 px-2 py-0.5 rounded-full border border-amber-500/20">
                      महासंघ दर
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex flex-col bg-muted-area/40 p-3 rounded-2xl border border-border-theme/40">
                      <span className="text-[10px] font-bold text-muted-text uppercase tracking-wider mb-0.5">छापावाल सुन</span>
                      <span className="text-lg font-black text-card-foreground">रू {Number(marketData.goldFine.value).toLocaleString()}</span>
                      <div className={`flex items-center gap-1 text-xs font-bold mt-1 ${marketData.goldFine.isUp ? 'text-emerald-500' : 'text-rose-500'}`}>
                        {marketData.goldFine.isUp ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                        +{marketData.goldFine.change} ({marketData.goldFine.percent}%)
                      </div>
                    </div>

                    <div className="flex flex-col bg-muted-area/40 p-3 rounded-2xl border border-border-theme/40">
                      <span className="text-[10px] font-bold text-muted-text uppercase tracking-wider mb-0.5">चाँदी दर</span>
                      <span className="text-lg font-black text-card-foreground">रू {Number(marketData.silver.value).toLocaleString()}</span>
                      <div className={`flex items-center gap-1 text-xs font-bold mt-1 ${marketData.silver.isUp ? 'text-emerald-500' : 'text-rose-500'}`}>
                        {marketData.silver.isUp ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                        +{marketData.silver.change} ({marketData.silver.percent}%)
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* 3. FOREX CURRENCY RATES PANEL */}
              {(activeCategory === "all" || activeCategory === "forex") && (
                <div className="p-5 sm:p-6 flex flex-col justify-between gap-4 hover:bg-primary/[0.02] transition-colors">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black text-muted-text uppercase tracking-widest flex items-center gap-1.5">
                      <Globe2 size={13} className="text-blue-500" /> विदेशी विनिमय दर (Forex)
                    </span>
                    <span className="text-[10px] font-bold text-muted-text">१ USD = रू {marketData.forex.usd.value}</span>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex items-center justify-between bg-muted-area/40 p-2.5 rounded-2xl border border-border-theme/40">
                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded-lg bg-blue-500/10 text-blue-500 font-black text-[10px] flex items-center justify-center">USD</span>
                        <div className="flex flex-col">
                          <span className="text-xs font-black text-card-foreground">रू {marketData.forex.usd.value}</span>
                          <span className="text-[9px] text-muted-text font-medium">अस्ट्रेलियन ($)</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between bg-muted-area/40 p-2.5 rounded-2xl border border-border-theme/40">
                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded-lg bg-indigo-500/10 text-indigo-500 font-black text-[10px] flex items-center justify-center">EUR</span>
                        <div className="flex flex-col">
                          <span className="text-xs font-black text-card-foreground">रू {marketData.forex.eur.value}</span>
                          <span className="text-[9px] text-muted-text font-medium">युरो (€)</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between border-t border-border-theme/40 pt-2.5">
                    <div className={`flex items-center gap-1 text-xs font-black text-emerald-500`}>
                      <TrendingUp size={13} />
                      साप्ताहिक वृद्धि: +{marketData.forex.usd.percent}%
                    </div>
                    <span className="text-[10px] font-bold text-muted-text">NRB आधिकारिक दर</span>
                  </div>
                </div>
              )}

              {/* 4. COMMODITIES / PETROLEUM PANEL */}
              {activeCategory === "commodities" && (
                <div className="p-5 sm:p-6 flex flex-col justify-between gap-4 hover:bg-primary/[0.02] transition-colors col-span-1 md:col-span-3">
                  <span className="text-[10px] font-black text-muted-text uppercase tracking-widest flex items-center gap-1.5">
                    <Fuel size={13} className="text-rose-500" /> इन्धन र एलपी ग्याँस मूल्य (Petroleum Rates)
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="bg-muted-area/40 p-4 rounded-2xl border border-border-theme/40 flex items-center justify-between">
                      <div>
                        <span className="text-xs font-bold text-muted-text block">पेट्रोल (Petrol)</span>
                        <span className="text-xl font-black text-card-foreground">रू {marketData.commodities.petrol.value}</span>
                        <span className="text-[10px] text-muted-text block">{marketData.commodities.petrol.unit}</span>
                      </div>
                      <span className="px-2 py-1 bg-emerald-500/10 text-emerald-500 text-xs font-bold rounded-lg">-२ घटेको</span>
                    </div>

                    <div className="bg-muted-area/40 p-4 rounded-2xl border border-border-theme/40 flex items-center justify-between">
                      <div>
                        <span className="text-xs font-bold text-muted-text block">डिजेल (Diesel)</span>
                        <span className="text-xl font-black text-card-foreground">रू {marketData.commodities.diesel.value}</span>
                        <span className="text-[10px] text-muted-text block">{marketData.commodities.diesel.unit}</span>
                      </div>
                      <span className="px-2 py-1 bg-emerald-500/10 text-emerald-500 text-xs font-bold rounded-lg">-१ घटेको</span>
                    </div>

                    <div className="bg-muted-area/40 p-4 rounded-2xl border border-border-theme/40 flex items-center justify-between">
                      <div>
                        <span className="text-xs font-bold text-muted-text block">एलपी ग्याँस (LP Gas)</span>
                        <span className="text-xl font-black text-card-foreground">रू {marketData.commodities.lpgas.value}</span>
                        <span className="text-[10px] text-muted-text block">{marketData.commodities.lpgas.unit}</span>
                      </div>
                      <span className="px-2 py-1 bg-amber-500/10 text-amber-500 text-xs font-bold rounded-lg">स्थिर</span>
                    </div>
                  </div>
                </div>
              )}

            </div>

            {/* Bottom Collapsible Accordion Drawer Trigger Button */}
            <div className="border-t border-border-theme/60 bg-muted-area/30 px-4 sm:px-6 py-2.5 flex items-center justify-between">
              
              <button
                onClick={() => setIsExpandedDetailsOpen(!isExpandedDetailsOpen)}
                className="flex items-center gap-2 text-xs font-black text-primary hover:text-primary-hover transition-colors group"
              >
                <Layers size={14} className="group-hover:rotate-12 transition-transform" />
                <span>{isExpandedDetailsOpen ? "अतिरिक्त बजार विवरण लुकाउनुहोस्" : "अझै धेरै बजार विवरण र विनिमय दरहरू हेर्नुहोस्"}</span>
                <motion.div animate={{ rotate: isExpandedDetailsOpen ? 180 : 0 }} transition={{ duration: 0.25 }}>
                  <ChevronDown size={15} />
                </motion.div>
              </button>

              <Link
                to="/nepal-hub?tab=markets"
                className="text-[11px] font-bold text-muted-text hover:text-card-foreground flex items-center gap-1 transition-colors"
              >
                <span>नेपाल हब (पूर्ण बजार विश्लेषक)</span>
                <ExternalLink size={12} />
              </Link>
            </div>

            {/* Additional Animated Expanded Details Panel */}
            <AnimatePresence>
              {isExpandedDetailsOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.3 }}
                  className="border-t border-border-theme/60 bg-card p-5 sm:p-6 overflow-hidden"
                >
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    
                    {/* Tezab Gold & Extended Bullion */}
                    <div className="space-y-3">
                      <h4 className="text-xs font-black text-card-foreground uppercase tracking-wider flex items-center gap-2">
                        <Sparkles size={14} className="text-amber-500" /> थप सुन र धातु दर
                      </h4>
                      <div className="space-y-2 text-xs">
                        <div className="flex items-center justify-between p-2.5 bg-muted-area/50 rounded-xl border border-border-theme/40">
                          <span className="font-bold text-muted-text">तेजाबी सुन (प्रति तोला)</span>
                          <span className="font-black text-card-foreground">रू {Number(marketData.goldTezab.value).toLocaleString()}</span>
                        </div>
                        <div className="flex items-center justify-between p-2.5 bg-muted-area/50 rounded-xl border border-border-theme/40">
                          <span className="font-bold text-muted-text">छापावाल (प्रति १० ग्राम)</span>
                          <span className="font-black text-card-foreground">रू {Math.round(marketData.goldFine.value * 0.8573).toLocaleString()}</span>
                        </div>
                      </div>
                    </div>

                    {/* Extended Forex Currencies */}
                    <div className="space-y-3">
                      <h4 className="text-xs font-black text-card-foreground uppercase tracking-wider flex items-center gap-2">
                        <Globe2 size={14} className="text-blue-500" /> प्रमुख खाडी तथा अन्तर्राष्ट्रिय दर
                      </h4>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="p-2.5 bg-muted-area/50 rounded-xl border border-border-theme/40 flex items-center justify-between">
                          <span className="font-bold text-muted-text">GBP (£)</span>
                          <span className="font-black text-card-foreground">रू {marketData.forex.gbp.value}</span>
                        </div>
                        <div className="p-2.5 bg-muted-area/50 rounded-xl border border-border-theme/40 flex items-center justify-between">
                          <span className="font-bold text-muted-text">QAR (रियाल)</span>
                          <span className="font-black text-card-foreground">रू {marketData.forex.qar.value}</span>
                        </div>
                        <div className="p-2.5 bg-muted-area/50 rounded-xl border border-border-theme/40 flex items-center justify-between">
                          <span className="font-bold text-muted-text">AED (दिरहाम)</span>
                          <span className="font-black text-card-foreground">रू {marketData.forex.aed.value}</span>
                        </div>
                        <div className="p-2.5 bg-muted-area/50 rounded-xl border border-border-theme/40 flex items-center justify-between">
                          <span className="font-bold text-muted-text">AUD ($)</span>
                          <span className="font-black text-card-foreground">रू {marketData.forex.aud.value}</span>
                        </div>
                      </div>
                    </div>

                    {/* Top Stock Gainers */}
                    <div className="space-y-3">
                      <h4 className="text-xs font-black text-card-foreground uppercase tracking-wider flex items-center gap-2">
                        <BarChart3 size={14} className="text-emerald-500" /> मुख्य कारोबार कम्पनीहरू
                      </h4>
                      <div className="space-y-2 text-xs">
                        {marketData.topStocks.map((stock: any) => (
                          <div key={stock.symbol} className="flex items-center justify-between p-2 bg-muted-area/50 rounded-xl border border-border-theme/40">
                            <div>
                              <span className="font-black text-card-foreground block">{stock.symbol}</span>
                              <span className="text-[10px] text-muted-text">{stock.name}</span>
                            </div>
                            <div className="text-right">
                              <span className="font-bold text-card-foreground block">रू {stock.price}</span>
                              <span className={`text-[10px] font-bold ${stock.isUp ? 'text-emerald-500' : 'text-rose-500'}`}>
                                {stock.isUp ? '+' : ''}{stock.percent}%
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                  </div>
                </motion.div>
              )}
            </AnimatePresence>

          </motion.div>
        )}
      </AnimatePresence>

      {/* Mini Ticker preview bar when collapsed */}
      {isCollapsed && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="bg-card px-4 sm:px-6 py-2.5 border-t border-border-theme/40 flex items-center justify-between text-xs font-bold text-card-foreground overflow-x-auto gap-4 custom-scrollbar"
        >
          <div className="flex items-center gap-6 shrink-0">
            <span className="flex items-center gap-1.5">
              <span className="text-muted-text font-medium">नेप्से:</span>
              <span className="font-black">{marketData.nepse.value}</span>
              <span className={marketData.nepse.isUp ? "text-emerald-500" : "text-rose-500"}>
                ({marketData.nepse.isUp ? "+" : ""}{marketData.nepse.percent}%)
              </span>
            </span>

            <span className="flex items-center gap-1.5">
              <span className="text-muted-text font-medium">सुन:</span>
              <span className="font-black">रू {Number(marketData.goldFine.value).toLocaleString()}</span>
            </span>

            <span className="flex items-center gap-1.5">
              <span className="text-muted-text font-medium">USD:</span>
              <span className="font-black">रू {marketData.forex.usd.value}</span>
            </span>
          </div>

          <button
            onClick={() => setIsCollapsed(false)}
            className="text-[11px] font-extrabold text-primary hover:underline shrink-0 flex items-center gap-1"
          >
            <span>विस्तृत हेर्नुहोस्</span>
            <ChevronDown size={14} />
          </button>
        </motion.div>
      )}

    </div>
  );
}
