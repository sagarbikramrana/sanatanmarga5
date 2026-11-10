#!/bin/bash
cat << 'REPLACE_SCRIPT' > replace_district.py
import re

with open("src/pages/DistrictPage.tsx", "r") as f:
    content = f.read()

content = content.replace("import { collection, query, where, orderBy, onSnapshot } from \"firebase/firestore\";", "import { collection, query, where, orderBy, getDocs } from \"firebase/firestore\";")

start_str = "    const unsubscribe = onSnapshot(q, (snapshot) => {"
end_str = "    return () => unsubscribe();\n  }, [districtName]);"

start_idx = content.find(start_str)
end_idx = content.find(end_str)

if start_idx != -1 and end_idx != -1:
    new_code = """    const fetchDistrict = async () => {
      try {
        const snapshot = await getDocs(q);
        setArticles(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Article)));
      } catch (err) {
        console.error("Error fetching district articles:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchDistrict();
"""
    new_content = content[:start_idx] + new_code + "  }, [districtName]);" + content[end_idx + len(end_str):]
    with open("src/pages/DistrictPage.tsx", "w") as f:
        f.write(new_content)
    print("Patched DistrictPage.tsx")
else:
    print("Block not found in DistrictPage.tsx")
REPLACE_SCRIPT
python3 replace_district.py
