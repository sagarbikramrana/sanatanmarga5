#!/bin/bash
cat << 'REPLACE_SCRIPT' > replace_adslider.py
import re

with open("src/components/ads/AdSlider.tsx", "r") as f:
    content = f.read()

content = content.replace("import { collection, query, where, onSnapshot } from \"firebase/firestore\";", "import { collection, query, where, getDocs } from \"firebase/firestore\";")

start_str = "    const unsubscribe = onSnapshot(q, (snapshot) => {"
end_str = "    return () => unsubscribe();\n  }, []);"

start_idx = content.find(start_str)
end_idx = content.find(end_str)

if start_idx != -1 and end_idx != -1:
    new_code = """    const fetchAds = async () => {
      try {
        const snapshot = await getDocs(q);
        const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Ad));
        setAds(docs);
      } catch (error) {
        console.error("Error fetching ads:", error);
      }
    };
    fetchAds();
"""
    new_content = content[:start_idx] + new_code + "  }, []);" + content[end_idx + len(end_str):]
    with open("src/components/ads/AdSlider.tsx", "w") as f:
        f.write(new_content)
    print("Patched AdSlider.tsx")
else:
    print("Block not found in AdSlider.tsx")
REPLACE_SCRIPT
python3 replace_adslider.py
