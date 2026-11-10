#!/bin/bash
cat << 'REPLACE_SCRIPT' > replace.py
import re

with open("src/pages/HomePage.tsx", "r") as f:
    content = f.read()

# Replace useEffect body up to fetchMostRead();
start_str = "useEffect(() => {"
end_str = "    fetchMostRead();"

start_idx = content.find(start_str)
end_idx = content.find(end_str)

if start_idx != -1 and end_idx != -1:
    new_use_effect = """useEffect(() => {
    const fetchHomepageData = async () => {
      try {
        const response = await fetch('/api/homepage-data');
        if (response.ok) {
          const data = await response.json();
          setLayout(data.layout);
          setCategories(data.categories || []);
          setCategoryArticles(data.categoryArticles || {});
          setFeaturedArticles(data.featuredArticles || []);
          setLatestNews(data.latestNews || []);
          setVideoNews(data.videoNews || []);
          setMostReadNews(data.mostReadNews || []);
        } else {
          console.error("Failed to fetch homepage data");
        }
      } catch (err) {
        console.error("Error fetching homepage data:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchHomepageData();"""
    
    # Also find the return () => { cleanup } block and replace it
    end_cleanup_str = "    return () => {"
    end_cleanup_idx = content.find(end_cleanup_str, end_idx)
    end_brace_idx = content.find("  }, []);", end_cleanup_idx)
    
    if end_cleanup_idx != -1 and end_brace_idx != -1:
        new_content = content[:start_idx] + new_use_effect + "\n  }, []);" + content[end_brace_idx + 9:]
        with open("src/pages/HomePage.tsx", "w") as f:
            f.write(new_content)
        print("Patched HomePage.tsx successfully.")
    else:
        print("Cleanup block not found.")
else:
    print("Start or end block not found.")
REPLACE_SCRIPT
python3 replace.py
