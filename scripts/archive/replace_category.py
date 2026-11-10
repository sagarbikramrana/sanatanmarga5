import re

with open("src/pages/CategoryPage.tsx", "r") as f:
    content = f.read()

start_str = "    const unsubscribe = onSnapshot(q, (snapshot) => {"
end_str = "    return () => unsubscribe();\n  }, [slug]);"

start_idx = content.find(start_str)
end_idx = content.find(end_str)

if start_idx != -1 and end_idx != -1:
    new_code = """    const fetchCategoryArticles = async () => {
      try {
        const snapshot = await getDocsWithCacheFallback(q);
        const articlesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Article));
        setArticles(articlesData);
        setLastDoc(snapshot.docs[snapshot.docs.length - 1]);
        setHasMore(snapshot.docs.length === 10);
      } catch (error) {
        console.error("Error fetching category articles:", error);
        handleFirestoreError(error, OperationType.LIST, `articles/category/${slug}`);
      } finally {
        setLoading(false);
      }
    };
    
    fetchCategoryArticles();
"""
    new_content = content[:start_idx] + new_code + "  }, [slug]);" + content[end_idx + len(end_str):]
    with open("src/pages/CategoryPage.tsx", "w") as f:
        f.write(new_content)
    print("Patched CategoryPage.tsx")
else:
    print("Block not found in CategoryPage.tsx")
