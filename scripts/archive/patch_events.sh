#!/bin/bash
cat << 'REPLACE_SCRIPT' > replace_events.py
import re

with open("src/pages/EventsPage.tsx", "r") as f:
    content = f.read()

content = content.replace("import { collection, query, where, onSnapshot } from \"firebase/firestore\";", "import { collection, query, where, getDocs } from \"firebase/firestore\";")

start_str = "    const unsub = onSnapshot(q, (snapshot) => {"
end_str = "    return () => unsub();\n  }, [activeTab]);"

start_idx = content.find(start_str)
end_idx = content.find(end_str)

if start_idx != -1 and end_idx != -1:
    new_code = """    const fetchEvents = async () => {
      try {
        const snapshot = await getDocs(q);
        const fetchedEvents = snapshot.docs.map(doc => {
          const data = doc.data();
          let parsedDate = new Date();
          if (data.date) {
             if (data.date.toDate) parsedDate = data.date.toDate();
             else parsedDate = new Date(data.date);
          }
          return {
             id: doc.id,
             ...data,
             date: parsedDate
          };
        }) as SanatanEvent[];
        setEvents(fetchedEvents);
      } catch (err) {
        console.error("Error fetching events:", err);
      } finally {
        setLoading(false);
      }
    };
    
    fetchEvents();
"""
    new_content = content[:start_idx] + new_code + "  }, [activeTab]);" + content[end_idx + len(end_str):]
    with open("src/pages/EventsPage.tsx", "w") as f:
        f.write(new_content)
    print("Patched EventsPage.tsx")
else:
    print("Block not found in EventsPage.tsx")
REPLACE_SCRIPT
python3 replace_events.py
