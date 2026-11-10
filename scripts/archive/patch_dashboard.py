import re

with open("src/pages/ExecutiveDashboard.tsx", "r") as f:
    content = f.read()

# 1. Add os state and interface
if 'telemetry' not in content:
    content = content.replace("export default function ExecutiveDashboard() {", """
interface TelemetryData {
  healthScore: { overall: string, freshness: string, integrity: string, recovery: string, manifestSync: string };
  metrics: { 
    snapshotsBuiltToday: number, averageBuildTimeMs: number, largestSnapshotBytes: number, smallestSnapshotBytes: number,
    failedBuilds: number, manifestUpdates: number, snapshotReadSavingsPercent: number, cacheHitRatePercent: number,
    serverCacheStatus: string, adminDbConnected: boolean, totalSnapshotsInCache: number 
  };
  architecture: string;
}

export default function ExecutiveDashboard() {
  const [telemetry, setTelemetry] = useState<TelemetryData | null>(null);
  
  useEffect(() => {
    fetch('/api/admin/telemetry').then(r => r.json()).then(data => {
      if (data.success) setTelemetry(data);
    }).catch(e => console.error(e));
  }, []);
""")

# 2. Add 'os' to activeTab state
content = content.replace("<'command' | 'editorial' | 'intelligence' | 'reporters' | 'audience' | 'revenue'>", "<'command' | 'intelligence' | 'reporters' | 'audience' | 'revenue' | 'os'>")

# 3. Add 'os' tab button
if "{ id: 'os', label: 'Snapshot OS / Infrastructure' }" not in content:
    content = content.replace("{ id: 'revenue', label: 'राजस्व केन्द्र (Revenue)' }", "{ id: 'revenue', label: 'राजस्व केन्द्र (Revenue)' },\n            { id: 'os', label: 'Snapshot OS / Infrastructure' }")

# 4. Add 'os' tab UI
os_tab_ui = """
        {/* TAB 6: SNAPSHOT OS DASHBOARD */}
        {activeTab === 'os' && telemetry && (
          <div className="space-y-6">
            <h3 className="text-lg font-black text-card-foreground uppercase tracking-tight flex items-center gap-2">
              <Server size={20} className="text-primary" /> Snapshot OS (V4.0) Operations
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-card border border-border-theme rounded-2xl p-5 space-y-2">
                <span className="text-[10px] font-black uppercase text-muted-text">Overall Health Score</span>
                <div className="text-3xl font-black text-emerald-600 font-mono">{telemetry.healthScore.overall}</div>
                <div className="text-xs text-muted-text font-medium flex justify-between">
                   <span>Freshness: {telemetry.healthScore.freshness}</span>
                   <span>Integrity: {telemetry.healthScore.integrity}</span>
                </div>
              </div>
              <div className="bg-card border border-border-theme rounded-2xl p-5 space-y-2">
                <span className="text-[10px] font-black uppercase text-muted-text">Builds Today</span>
                <div className="text-3xl font-black text-primary font-mono">{telemetry.metrics.snapshotsBuiltToday}</div>
                <div className="text-xs text-muted-text font-medium flex justify-between">
                   <span>Failed: <span className="text-red-500 font-bold">{telemetry.metrics.failedBuilds}</span></span>
                   <span>Updates: {telemetry.metrics.manifestUpdates}</span>
                </div>
              </div>
              <div className="bg-card border border-border-theme rounded-2xl p-5 space-y-2">
                <span className="text-[10px] font-black uppercase text-muted-text">Build Performance</span>
                <div className="text-3xl font-black text-card-foreground font-mono">{telemetry.metrics.averageBuildTimeMs} <span className="text-sm">ms</span></div>
                <div className="text-xs text-muted-text font-medium flex justify-between">
                   <span>Largest: {(telemetry.metrics.largestSnapshotBytes / 1024).toFixed(1)} KB</span>
                   <span>Cache: {telemetry.metrics.totalSnapshotsInCache} items</span>
                </div>
              </div>
              <div className="bg-card border border-border-theme rounded-2xl p-5 space-y-2">
                <span className="text-[10px] font-black uppercase text-muted-text">Quota Savings</span>
                <div className="text-3xl font-black text-purple-600 font-mono">{telemetry.metrics.snapshotReadSavingsPercent}%</div>
                <div className="text-xs text-muted-text font-medium flex justify-between">
                   <span>Hit Rate: {telemetry.metrics.cacheHitRatePercent}%</span>
                   <span className={telemetry.metrics.adminDbConnected ? "text-emerald-500" : "text-red-500"}>DB: {telemetry.metrics.adminDbConnected ? 'Connected' : 'Offline'}</span>
                </div>
              </div>
            </div>

            <div className="bg-card border border-border-theme rounded-3xl p-6">
              <h4 className="text-sm font-black uppercase text-card-foreground mb-4">Architecture</h4>
              <p className="text-xs text-muted-text font-medium bg-muted-area/50 p-4 rounded-xl border border-border-theme font-mono">
                {telemetry.architecture}
              </p>
              <div className="mt-4 flex gap-4">
                <button onClick={() => { fetch('/api/admin/rebuild-snapshots', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ triggerSource: 'admin_dashboard' }) }).then(r => r.json()).then(d => toast.success(`Rebuild Queued: ${d.jobId}`)); }} className="px-4 py-2 bg-primary text-white rounded-xl text-xs font-bold shadow-md hover:scale-105 transition-transform flex items-center gap-2">
                  <RefreshCw size={14} /> Queue Rebuild
                </button>
                <button onClick={() => { fetch('/api/admin/recovery-drill', { method: 'POST' }).then(r => r.json()).then(d => toast.success(d.message)); }} className="px-4 py-2 bg-red-600 text-white rounded-xl text-xs font-bold shadow-md hover:scale-105 transition-transform flex items-center gap-2">
                  <ShieldCheck size={14} /> Run DR Drill
                </button>
              </div>
            </div>
          </div>
        )}
"""

content = content.replace("      </div>\n    </AdminLayout>", os_tab_ui + "\n      </div>\n    </AdminLayout>")

with open("src/pages/ExecutiveDashboard.tsx", "w") as f:
    f.write(content)

print("Dashboard patched")
