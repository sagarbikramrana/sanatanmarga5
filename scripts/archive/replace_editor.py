import re

with open("src/pages/EditorDashboard.tsx", "r") as f:
    content = f.read()

content = content.replace('import { collection, query, where, orderBy, limit, onSnapshot, addDoc }', 'import { collection, query, where, orderBy, limit, getDocs, addDoc }')

start_str = "    const unsubscribe = onSnapshot(q, (snapshot) => {"
end_str = "    return () => unsubscribe();\n  }, [user, authLoading]);"

start_idx = content.find(start_str)
end_idx = content.find(end_str)

if start_idx != -1 and end_idx != -1:
    new_code = """    const fetchDashboardData = async () => {
      try {
        const snapshot = await getDocs(q);
        const myArticles = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Article));
        setRecentArticles(myArticles);
        
        let views = 0;
        let drafts = 0;
        myArticles.forEach(a => {
          views += a.views || 0;
          if (a.status === "draft") drafts++;
        });
        
        setStats(prev => ({ ...prev, totalViews: views, pendingDrafts: drafts }));
      } catch (err) {
        handleFirestoreError(err, "EditorDashboard");
      }
    };

    fetchDashboardData();
    const interval = setInterval(fetchDashboardData, 60000); // Periodic fetch every 60s
"""
    new_content = content[:start_idx] + new_code + "\n    return () => clearInterval(interval);\n  }, [user, authLoading]);" + content[end_idx + len(end_str):]
    with open("src/pages/EditorDashboard.tsx", "w") as f:
        f.write(new_content)
    print("Patched EditorDashboard.tsx")
else:
    print("Block not found in EditorDashboard.tsx")
