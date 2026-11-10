#!/bin/bash
cat << 'REPLACE_SCRIPT' > replace_adbanner.py
import re

with open("src/components/ads/AdBanner.tsx", "r") as f:
    content = f.read()

content = content.replace("import { db, safeOnSnapshot } from \"@/src/lib/firebase\";", "import { db } from \"@/src/lib/firebase\";")
content = content.replace("import { collection, query, where, onSnapshot, doc, getDoc } from \"firebase/firestore\";", "import { collection, query, where, getDocs, doc, getDoc } from \"firebase/firestore\";")

start_str = "    const unsubscribeAds = safeOnSnapshot(q, (snapshot) => {"
end_str = "    return () => {\n      unsubscribeAds();\n      unsubscribeSettings();\n    };\n  }, [position]);"

start_idx = content.find(start_str)
end_idx = content.find(end_str)

if start_idx != -1 and end_idx != -1:
    new_code = """    const fetchAdsAndSettings = async () => {
      try {
        const snapshot = await getDocs(q);
        const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Ad));
        setAds(docs);
        
        const docSnap = await getDoc(doc(db, "settings", "site"));
        if (docSnap.exists()) {
          const data = docSnap.data();
          setAdSenseClient(data.adSenseClient || "");
          setDefaultAdSenseSlot(data.adSenseSlot || "");
        }
      } catch (error) {
        console.error("Error fetching ads/settings:", error);
      }
    };
    fetchAdsAndSettings();
"""
    new_content = content[:start_idx] + new_code + "  }, [position]);" + content[end_idx + len(end_str):]
    with open("src/components/ads/AdBanner.tsx", "w") as f:
        f.write(new_content)
    print("Patched AdBanner.tsx")
else:
    print("Block not found in AdBanner.tsx")
REPLACE_SCRIPT
python3 replace_adbanner.py
