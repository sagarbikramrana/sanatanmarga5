#!/bin/bash
cat << 'REPLACE_SCRIPT' > replace_mobilenav.py
import re

with open("src/components/layout/MobileBottomNav.tsx", "r") as f:
    content = f.read()

content = content.replace("import { collection, query, where, orderBy, limit, onSnapshot, doc, updateDoc, writeBatch } from \"firebase/firestore\";", "import { collection, query, where, orderBy, limit, getDocs, doc, updateDoc, writeBatch } from \"firebase/firestore\";")

start_str = "    const unsubscribe = onSnapshot(q, (snapshot) => {"
end_str = "    return () => unsubscribe();\n  }, [user]);"

start_idx = content.find(start_str)
end_idx = content.find(end_str)

if start_idx != -1 and end_idx != -1:
    new_code = """    const fetchNotifications = async () => {
      try {
        const snapshot = await getDocs(q);
        const docs = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Notification));
        setNotifications(docs);
      } catch (err) {
        console.warn("Notifications warning:", err);
      }
    };
    
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 120000); // 2 minutes
"""
    new_content = content[:start_idx] + new_code + "\n    return () => clearInterval(interval);\n  }, [user]);" + content[end_idx + len(end_str):]
    with open("src/components/layout/MobileBottomNav.tsx", "w") as f:
        f.write(new_content)
    print("Patched MobileBottomNav.tsx")
else:
    print("Block not found in MobileBottomNav.tsx")
REPLACE_SCRIPT
python3 replace_mobilenav.py
