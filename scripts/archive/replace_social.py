import re

with open("src/pages/SocialHubPage.tsx", "r") as f:
    content = f.read()

content = content.replace('import { collection, query, orderBy, onSnapshot, where }', 'import { collection, query, orderBy, getDocs, where }')

start_str = "    // Accounts listener"
end_str = "    return () => {\n      unsubAcc();\n      unsubPost();\n    };\n  }, []);"

start_idx = content.find(start_str)
end_idx = content.find(end_str)

if start_idx != -1 and end_idx != -1:
    new_code = """    const fetchSocialData = async () => {
      try {
        const accQ = query(collection(db, "socialAccounts"), orderBy("order", "asc"));
        const accSnap = await getDocs(accQ);
        if (!accSnap.empty) {
          const docs = accSnap.docs.map(d => ({ id: d.id, ...d.data() } as SocialAccount)).filter(a => a.isActive);
          if (docs.length > 0) setAccounts(docs);
        }

        const postQ = query(collection(db, "socialPosts"), orderBy("createdAt", "desc"));
        const postSnap = await getDocs(postQ);
        if (!postSnap.empty) {
          const docs = postSnap.docs.map(d => ({ id: d.id, ...d.data() } as SocialPost));
          if (docs.length > 0) setPosts(docs);
        }
      } catch (err) {
        console.warn("Using fallback social data:", err);
      } finally {
        setLoading(false);
      }
    };
    
    fetchSocialData();
"""
    new_content = content[:start_idx] + new_code + "  }, []);" + content[end_idx + len(end_str):]
    with open("src/pages/SocialHubPage.tsx", "w") as f:
        f.write(new_content)
    print("Patched SocialHubPage.tsx")
else:
    print("Block not found in SocialHubPage.tsx")
