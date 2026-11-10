#!/bin/bash
cat << 'REPLACE_SCRIPT' > replace_header.py
import re

with open("src/components/layout/Header.tsx", "r") as f:
    content = f.read()

start_str = "    const unsub = onSnapshot(doc(db, \"settings\", \"site\"), (docSnap) => {"
end_str = "    });\n    return () => unsub();\n  }, []);"

start_idx = content.find(start_str)
end_idx = content.find(end_str)

if start_idx != -1 and end_idx != -1:
    new_code = """    const fetchSettings = async () => {
      try {
        const docSnap = await getDoc(doc(db, "settings", "site"));
        if (docSnap.exists()) {
          const data = docSnap.data();
          if (data.logoUrl) setLogoUrl(data.logoUrl);
          if (data.siteName) setSiteName(data.siteName);
          if (data.siteTagline) setSiteTagline(data.siteTagline);
          if (data.brandSlogan) setBrandSlogan(data.brandSlogan);
        }
      } catch (err) {
        console.error("Error fetching site settings:", err);
      }
    };
    fetchSettings();
"""
    new_content = content[:start_idx] + new_code + "  }, []);" + content[end_idx + len(end_str):]
    with open("src/components/layout/Header.tsx", "w") as f:
        f.write(new_content)
    print("Patched Header.tsx")
else:
    print("Block not found in Header.tsx")
REPLACE_SCRIPT
python3 replace_header.py
