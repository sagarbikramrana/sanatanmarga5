import re

with open("src/components/layout/AdminSidebar.tsx", "r") as f:
    content = f.read()

content = content.replace("import { doc, onSnapshot } from \"firebase/firestore\";", "import { doc, getDoc } from \"firebase/firestore\";")

start_str = "    const unsub = onSnapshot(doc(db, \"settings\", \"site\"), (doc) => {"
end_str = "    return () => unsub();\n  }, []);"

start_idx = content.find(start_str)
end_idx = content.find(end_str)

if start_idx != -1 and end_idx != -1:
    new_code = """    const fetchSettings = async () => {
      try {
        const docSnap = await getDoc(doc(db, "settings", "site"));
        if (docSnap.exists()) {
          setSettings(prev => ({ ...prev, ...docSnap.data() }));
        }
      } catch (err) {
        console.error("Error fetching admin sidebar settings:", err);
      }
    };
    fetchSettings();
"""
    new_content = content[:start_idx] + new_code + "  }, []);" + content[end_idx + len(end_str):]
    with open("src/components/layout/AdminSidebar.tsx", "w") as f:
        f.write(new_content)
    print("Patched AdminSidebar.tsx")
else:
    print("Block not found in AdminSidebar.tsx")
