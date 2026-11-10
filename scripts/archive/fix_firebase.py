with open("src/lib/firebase.ts", "r") as f:
    content = f.read()

content = content.replace("  getDocFromServer,", "  getDocs,\n  getDoc,\n  getDocFromServer,")

with open("src/lib/firebase.ts", "w") as f:
    f.write(content)
