import re

with open("src/pages/AdminOperations.tsx", "r") as f:
    content = f.read()

comp_def = """
function TelemetryTable({ activeTab }: { activeTab: string }) {
  const [metrics, setMetrics] = React.useState<any[]>([]);
  React.useEffect(() => {
    if (activeTab !== "telemetry") return;
    const loadMetrics = async () => {
      let clientMetrics: any = {};
      if (typeof window !== 'undefined') {
        const stored = window.localStorage.getItem('firestore_telemetry');
        if (stored) {
          try {
            clientMetrics = JSON.parse(stored);
          } catch (e) {}
        }
      }
      
      try {
        const res = await fetch("/api/system/telemetry");
        const serverData = await res.json();
        serverData.forEach((m: any) => {
          m.queryName = `[Server] ${m.queryName}`;
          clientMetrics[m.queryName] = m;
        });
      } catch (e) {
        console.warn("Failed to load server telemetry");
      }
      
      setMetrics(Object.values(clientMetrics).sort((a: any, b: any) => b.count - a.count));
    };
    loadMetrics();
    const interval = setInterval(loadMetrics, 5000);
    return () => clearInterval(interval);
  }, [activeTab]);
  
  if (metrics.length === 0) {
    return (
      <tr>
        <td colSpan={4} className="text-center py-8 text-neutral-600">No telemetry recorded yet. Load a few pages first.</td>
      </tr>
    );
  }
  
  return (
    <>
      {metrics.map((m, i) => (
        <tr key={i} className="border-b border-neutral-900 hover:bg-neutral-900/50">
          <td className="py-2 px-3 font-bold text-neutral-200">{m.queryName}</td>
          <td className="py-2 px-3 text-amber-500 font-bold">{m.count}</td>
          <td className="py-2 px-3">{Math.round(m.avgDuration)}ms</td>
          <td className="py-2 px-3 text-emerald-400">{m.source}</td>
        </tr>
      ))}
    </>
  );
}
"""

if "function TelemetryTable(" not in content:
    content = content.replace('export default function AdminOperations() {', comp_def + '\nexport default function AdminOperations() {')

content = re.sub(r'\{([^}]+)\(\) => \{\s+const \[metrics, setMetrics\] = React\.useState<any\[\]>\(\[\]\);.*?\}\)\(\)\}', '<TelemetryTable activeTab={activeTab} />', content, flags=re.DOTALL)

with open("src/pages/AdminOperations.tsx", "w") as f:
    f.write(content)
