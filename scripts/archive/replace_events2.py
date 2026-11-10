import re

with open("src/pages/EventsPage.tsx", "r") as f:
    content = f.read()

content = content.replace("import { collection, query, where, onSnapshot } from \"firebase/firestore\";", "import { collection, query, where, getDocs } from \"firebase/firestore\";")

start_str = "    const unsub = onSnapshot(q, (snapshot) => {"
end_str = "    return () => unsub();\n  }, []);"

start_idx = content.find(start_str)
end_idx = content.find(end_str)

if start_idx != -1 and end_idx != -1:
    new_code = """    const fetchEvents = async () => {
      try {
        const snapshot = await getDocs(q);
        const loaded = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        if (loaded.length > 0) {
          setEvents(loaded as any);
        } else {
          setEvents(SAMPLE_EVENTS);
        }
      } catch (err) {
        setEvents(SAMPLE_EVENTS);
      } finally {
        setLoading(false);
      }
    };
    
    fetchEvents();
"""
    new_content = content[:start_idx] + new_code + "  }, []);" + content[end_idx + len(end_str):]
    with open("src/pages/EventsPage.tsx", "w") as f:
        f.write(new_content)
    print("Patched EventsPage.tsx")
else:
    print("Block not found in EventsPage.tsx")
