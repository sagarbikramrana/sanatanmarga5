import re

with open("src/pages/AdminOperations.tsx", "r") as f:
    content = f.read()

content = content.replace('useState<"activity" | "errors" | "diagnostics">("activity")', 'useState<"activity" | "errors" | "diagnostics" | "telemetry">("activity")')

tab_str = """            <button
              onClick={() => setActiveTab("telemetry")}
              className={`pb-4 px-4 font-mono text-xs uppercase tracking-widest relative transition-all ${
                activeTab === "telemetry" ? "text-white font-bold" : "text-neutral-500 hover:text-neutral-300"
              }`}
            >
              टेलिमेट्री (Telemetry)
              {activeTab === "telemetry" && (
                <motion.div layoutId="active-tab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500" />
              )}
            </button>"""

content = content.replace('              स्वास्थ्य र डायग्नोस्टिक्स\n              {activeTab === "diagnostics" && (\n                <motion.div layoutId="active-tab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-amber-500" />\n              )}\n            </button>',
    '              स्वास्थ्य र डायग्नोस्टिक्स\n              {activeTab === "diagnostics" && (\n                <motion.div layoutId="active-tab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-amber-500" />\n              )}\n            </button>\n' + tab_str)

with open("src/pages/AdminOperations.tsx", "w") as f:
    f.write(content)
