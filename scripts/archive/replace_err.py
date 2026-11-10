import re

with open("src/pages/EditorDashboard.tsx", "r") as f:
    content = f.read()

new_content = content.replace('handleFirestoreError(err, "EditorDashboard");', 'handleFirestoreError(err, OperationType.LIST, "EditorDashboard");')

with open("src/pages/EditorDashboard.tsx", "w") as f:
    f.write(new_content)
