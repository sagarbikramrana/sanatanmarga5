#!/bin/bash
cat << 'REPLACE_SCRIPT' > replace_firebase.py
import re

with open("src/lib/firebase.ts", "r") as f:
    content = f.read()

# Replace getDocsFromServer with getDocs in getDocsWithCacheFallback
content = content.replace("const snapshot = await getDocsFromServer(q);", "const snapshot = await getDocs(q);")

# Replace getDocFromServer with getDoc in getDocWithCacheFallback
content = content.replace("const snapshot = await getDocFromServer(docRef);", "const snapshot = await getDoc(docRef);")

# Update imports to include getDocs and getDoc if not already present, though they likely are.
# Actually they are likely imported, but let's just make the replacement.
with open("src/lib/firebase.ts", "w") as f:
    f.write(content)
print("Patched firebase.ts")
REPLACE_SCRIPT
python3 replace_firebase.py
