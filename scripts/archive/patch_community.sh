#!/bin/bash
cat << 'REPLACE_SCRIPT' > replace_community.py
import re

with open("src/pages/CommunityPage.tsx", "r") as f:
    content = f.read()

content = content.replace("import { safeOnSnapshot } from \"@/src/lib/firebase\";", "import { getDocsWithCacheFallback } from \"@/src/lib/firebase\";")

start_str = "    let active = true;\n    const unsubscribe = safeOnSnapshot(q, (snapshot) => {"
end_str = "    return () => {\n      active = false;\n      unsubscribe();\n    };\n  }, [sortBy, selectedCategory]);"

start_idx = content.find(start_str)
end_idx = content.find(end_str)

if start_idx != -1 and end_idx != -1:
    new_code = """    let active = true;
    const fetchPosts = async () => {
      try {
        const snapshot = await getDocsWithCacheFallback(q);
        if (!active) return;
        const postsData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as CommunityPost[];
        
        setPosts(postsData);
      } catch (err) {
        console.error("Error fetching community posts:", err);
      } finally {
        if (active) setLoading(false);
      }
    };
    
    fetchPosts();
"""
    new_content = content[:start_idx] + new_code + "    return () => {\n      active = false;\n    };\n  }, [sortBy, selectedCategory]);" + content[end_idx + len(end_str):]
    with open("src/pages/CommunityPage.tsx", "w") as f:
        f.write(new_content)
    print("Patched CommunityPage.tsx")
else:
    print("Block not found in CommunityPage.tsx")
REPLACE_SCRIPT
python3 replace_community.py
