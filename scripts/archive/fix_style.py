with open("src/components/StyleProvider.tsx", "r") as f:
    content = f.read()

start_str = "  useEffect(() => {\n    const fetchTheme"
end_str = "    }, [isDarkMode]);"

start_idx = content.find(start_str)
end_idx = content.find(end_str)

if start_idx != -1 and end_idx != -1:
    new_code = """  useEffect(() => {
    const fetchTheme = async () => {
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

    const root = document.documentElement;
    if (isDarkMode) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [isDarkMode]);"""
    new_content = content[:start_idx] + new_code + content[end_idx + len(end_str):]
    with open("src/components/StyleProvider.tsx", "w") as f:
        f.write(new_content)
    print("Fixed StyleProvider.tsx")
else:
    print("Could not find block")
