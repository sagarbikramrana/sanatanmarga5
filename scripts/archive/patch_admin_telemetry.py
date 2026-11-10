import re

with open("src/pages/AdminOperations.tsx", "r") as f:
    content = f.read()

telemetry_str = """
              {activeTab === "telemetry" && (
                <motion.div
                  key="telemetry-tab"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="space-y-6 flex-1 flex flex-col min-h-0 overflow-hidden"
                >
                  <div className="flex justify-between items-center mb-2">
                    <div className="text-neutral-400 text-xs font-mono">
                      Firestore Operations Dashboard & Telemetry
                    </div>
                    <button
                      onClick={() => {
                        if (typeof window !== "undefined") {
                          window.localStorage.removeItem("firestore_telemetry");
                          window.location.reload();
                        }
                      }}
                      className="px-2 py-1 bg-red-950/30 text-red-400 border border-red-900/50 rounded flex items-center gap-2 text-xs font-mono hover:bg-red-900/50"
                    >
                      <Trash2 className="h-3 w-3" /> CLEAR METRICS
                    </button>
                  </div>
                  <div className="flex-1 overflow-y-auto pr-2 space-y-2">
                    <table className="w-full text-left text-xs font-mono text-neutral-400 border-collapse">
                      <thead>
                        <tr className="border-b border-neutral-800">
                          <th className="py-2 px-3 font-medium text-neutral-300">Query Target</th>
                          <th className="py-2 px-3 font-medium text-neutral-300">Call Count</th>
                          <th className="py-2 px-3 font-medium text-neutral-300">Avg Duration</th>
                          <th className="py-2 px-3 font-medium text-neutral-300">Last Source</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(() => {
                           let metrics: any[] = [];
                           if (typeof window !== 'undefined') {
                             const stored = window.localStorage.getItem('firestore_telemetry');
                             if (stored) {
                               try {
                                 const parsed = JSON.parse(stored);
                                 metrics = Object.values(parsed).sort((a: any, b: any) => b.count - a.count);
                               } catch (e) {}
                             }
                           }
                           
                           if (metrics.length === 0) {
                             return (
                               <tr>
                                 <td colSpan={4} className="text-center py-8 text-neutral-600">No telemetry recorded yet. Load a few pages first.</td>
                               </tr>
                             );
                           }
                           
                           return metrics.map((m, i) => (
                             <tr key={i} className="border-b border-neutral-900 hover:bg-neutral-900/50">
                               <td className="py-2 px-3 font-bold text-neutral-200">{m.queryName}</td>
                               <td className="py-2 px-3 text-amber-500 font-bold">{m.count}</td>
                               <td className="py-2 px-3">{Math.round(m.avgDuration)}ms</td>
                               <td className="py-2 px-3 text-emerald-400">{m.source}</td>
                             </tr>
                           ));
                        })()}
                      </tbody>
                    </table>
                  </div>
                </motion.div>
              )}
"""

content = content.replace("            </AnimatePresence>", telemetry_str + "            </AnimatePresence>")

with open("src/pages/AdminOperations.tsx", "w") as f:
    f.write(content)
