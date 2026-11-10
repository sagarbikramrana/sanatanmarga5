const fs = require('fs');
let content = fs.readFileSync('src/components/StyleProvider.tsx', 'utf8');

const startIdx = content.indexOf('  useEffect(() => {\n    const fetchTheme');
const endIdx = content.indexOf('    }, [isDarkMode]);') + '    }, [isDarkMode]);'.length;

if (startIdx !== -1 && endIdx !== -1) {
  const replacement = `  useEffect(() => {
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
  }, [isDarkMode]);`;
  
  content = content.substring(0, startIdx) + replacement + content.substring(endIdx);
  fs.writeFileSync('src/components/StyleProvider.tsx', content);
  console.log('Fixed StyleProvider.tsx');
} else {
  console.log('Could not find indices');
}
