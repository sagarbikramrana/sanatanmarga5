#!/bin/bash
cat << 'REPLACE_SCRIPT' > replace_admin.py
import re

with open("src/pages/AdminDashboard.tsx", "r") as f:
    content = f.read()

content = content.replace('import { collection, query, orderBy, limit, onSnapshot, addDoc }', 'import { collection, query, orderBy, limit, getDocs, addDoc }')

start_str = "    const unsubscribe = safeOnSnapshot(q, (snapshot) => {"
end_str = "  }, [user, authLoading]);"

start_idx = content.find(start_str)
end_idx = content.find(end_str)

if start_idx != -1 and end_idx != -1:
    new_code = """    const fetchAdminData = async () => {
      try {
        const snapshot = await getDocs(q);
        const allRecent = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Article));
        const updates = allRecent.filter(a => a.isBreaking || a.isFeatured).slice(0, 5);
        setRecentArticles(updates);
        
        let views = 0;
        let drafts = 0;
        allRecent.forEach(a => {
          views += a.views || 0;
          if (a.status === "draft") drafts++;
        });
        setStats(prev => ({ ...prev, totalViews: views, pendingDrafts: drafts }));
        
        const msgSnapshot = await getDocs(collection(db, "contactMessages"));
        const newCount = msgSnapshot.docs.filter(doc => doc.data().status === "new").length;
        setStats(prev => ({ ...prev, newMessages: newCount }));
      } catch (err) {
        console.error("Admin dashboard fetch error:", err);
      }
    };

    fetchAdminData();
    const interval = setInterval(fetchAdminData, 60000); // Periodic fetch every 60s

    return () => clearInterval(interval);
"""
    new_content = content[:start_idx] + new_code + content[end_idx:]
    with open("src/pages/AdminDashboard.tsx", "w") as f:
        f.write(new_content)
    print("Patched AdminDashboard.tsx")
else:
    print("Block not found in AdminDashboard.tsx")
REPLACE_SCRIPT
python3 replace_admin.py
