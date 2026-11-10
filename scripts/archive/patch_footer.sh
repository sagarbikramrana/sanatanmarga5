#!/bin/bash
cat << 'REPLACE_SCRIPT' > replace_footer.py
import re

with open("src/components/layout/Footer.tsx", "r") as f:
    content = f.read()

start_str = "    const unsub = safeOnSnapshot(doc(db, \"settings\", \"site\"), (docSpec) => {"
end_str = "    return () => unsub();\n  }, []);"

start_idx = content.find(start_str)
end_idx = content.find(end_str)

if start_idx != -1 and end_idx != -1:
    new_code = """    const fetchSettings = async () => {
      try {
        const { getDoc } = await import("firebase/firestore");
        const docSpec = await getDoc(doc(db, "settings", "site"));
        if (docSpec.exists()) {
          setSettings(prev => ({ ...prev, ...docSpec.data() }));
        }
      } catch (err) {
        console.error("Error fetching site settings:", err);
      }
    };
    fetchSettings();
"""
    new_content = content[:start_idx] + new_code + "  }, []);" + content[end_idx + len(end_str):]
    with open("src/components/layout/Footer.tsx", "w") as f:
        f.write(new_content)
    print("Patched Footer.tsx")
else:
    print("Block not found in Footer.tsx")
REPLACE_SCRIPT
python3 replace_footer.py
