import re

with open("src/components/layout/Sidebar.tsx", "r") as f:
    content = f.read()

start_str = "    const unsubscribe = safeOnSnapshot(q, (snapshot) => {"
end_str = "    return () => unsubscribe();\n  }, []);"

start_idx = content.find(start_str)
end_idx = content.find(end_str)

if start_idx != -1 and end_idx != -1:
    new_code = """    const fetchMostRead = async () => {
      try {
        const { getDocs } = await import("firebase/firestore");
        const snapshot = await getDocs(q);
        const articles = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Article));
        setMostRead(articles);
      } catch (err) {
        console.error("Error fetching most read:", err);
      }
    };
    fetchMostRead();
"""
    new_content = content[:start_idx] + new_code + "  }, []);" + content[end_idx + len(end_str):]
    with open("src/components/layout/Sidebar.tsx", "w") as f:
        f.write(new_content)
    print("Patched Sidebar.tsx")
else:
    print("Block not found in Sidebar.tsx")
