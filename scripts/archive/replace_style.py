import re

with open("src/components/StyleProvider.tsx", "r") as f:
    content = f.read()

content = content.replace("import { doc, onSnapshot } from \"firebase/firestore\";", "import { doc, getDoc } from \"firebase/firestore\";")

start_str = "    const unsub = onSnapshot(doc(db, \"settings\", \"site\"), (docSnap) => {"
end_str = "    });"

start_idx = content.find(start_str)
end_idx = content.find(end_str)

if start_idx != -1 and end_idx != -1:
    new_code = """    const fetchTheme = async () => {
      try {
        const docSnap = await getDoc(doc(db, "settings", "site"));
        if (docSnap.exists() && docSnap.data().theme) {
          setTheme(docSnap.data().theme);
        }
      } catch (err) {
        console.warn("Theme settings could not be loaded from server, using defaults:", err);
      }
    };
    fetchTheme();
"""
    new_content = content[:start_idx] + new_code + content[end_idx + len(end_str):]
    # Remove `return () => unsub();`
    new_content = new_content.replace("return () => unsub();\n  }, [isDarkMode]);", "}, [isDarkMode]);")
    with open("src/components/StyleProvider.tsx", "w") as f:
        f.write(new_content)
    print("Patched StyleProvider.tsx")
else:
    print("Block not found in StyleProvider.tsx")
