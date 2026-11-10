#!/bin/bash
cat << 'REPLACE_SCRIPT' > replace_notification.py
import re

with open("src/components/notifications/NotificationBell.tsx", "r") as f:
    content = f.read()

content = content.replace("import { collection, query, orderBy, limit, onSnapshot, doc, updateDoc, writeBatch, where } from \"firebase/firestore\";", "import { collection, query, orderBy, limit, getDocs, doc, updateDoc, writeBatch, where } from \"firebase/firestore\";")

start_str = "    const unsubscribe = onSnapshot(q, (snapshot) => {"
end_str = "    return () => unsubscribe();\n  }, [user]);"

start_idx = content.find(start_str)
end_idx = content.find(end_str)

if start_idx != -1 and end_idx != -1:
    new_code = """    const fetchNotifications = async () => {
      try {
        const snapshot = await getDocs(q);
        const newNotifications = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Notification));
        setNotifications(newNotifications);
        
        const latest = newNotifications[0];
        if (latest && latest.id !== lastNotificationId.current) {
          if (lastNotificationId.current !== null) {
            toast(latest.title, {
              description: latest.message,
              icon: latest.type === 'success' ? '✅' : latest.type === 'error' ? '❌' : 'ℹ️',
            });
          }
          lastNotificationId.current = latest.id;
        }
      } catch (err) {
        console.error("Error fetching notifications:", err);
      }
    };
    
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 120000); // 2 minutes
"""
    new_content = content[:start_idx] + new_code + "\n    return () => clearInterval(interval);\n  }, [user]);" + content[end_idx + len(end_str):]
    with open("src/components/notifications/NotificationBell.tsx", "w") as f:
        f.write(new_content)
    print("Patched NotificationBell.tsx")
else:
    print("Block not found in NotificationBell.tsx")
REPLACE_SCRIPT
python3 replace_notification.py
