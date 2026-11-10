#!/bin/bash
cat << 'REPLACE_SCRIPT' > replace_model.py
import re

with open("src/pages/ModelProfilePage.tsx", "r") as f:
    content = f.read()

content = content.replace("import { doc, getDoc, collection, addDoc, serverTimestamp, query, where, orderBy, onSnapshot, setDoc, deleteDoc } from \"firebase/firestore\";", "import { doc, getDoc, collection, addDoc, serverTimestamp, query, where, orderBy, getDocs, setDoc, deleteDoc } from \"firebase/firestore\";")

start_str = "    if (isLightboxOpen && activeImage && model) {"
end_str = "      return () => {\n        unsubR();\n        unsubC();\n      };\n    }\n  }, [isLightboxOpen, activeImageIndex, model]);"

start_idx = content.find(start_str)
end_idx = content.find(end_str)

if start_idx != -1 and end_idx != -1:
    new_code = """    if (isLightboxOpen && activeImage && model) {
      const fetchGalleryData = async () => {
        try {
          const qR = query(collection(db, "galleryReactions"), where("imageId", "==", activeImage.id));
          const snapR = await getDocs(qR);
          setReactions(snapR.docs.map(d => ({ id: d.id, ...d.data() } as GalleryReaction)));
          
          const qC = query(collection(db, "galleryComments"), where("imageId", "==", activeImage.id), orderBy("createdAt", "asc"));
          const snapC = await getDocs(qC);
          setComments(snapC.docs.map(d => ({ id: d.id, ...d.data() } as GalleryComment)));
        } catch (err) {
          handleFirestoreError(err, OperationType.LIST, "gallery");
        }
      };
      fetchGalleryData();
    }
"""
    new_content = content[:start_idx] + new_code + "  }, [isLightboxOpen, activeImageIndex, model]);" + content[end_idx + len(end_str):]
    with open("src/pages/ModelProfilePage.tsx", "w") as f:
        f.write(new_content)
    print("Patched ModelProfilePage.tsx")
else:
    print("Block not found in ModelProfilePage.tsx")
REPLACE_SCRIPT
python3 replace_model.py
