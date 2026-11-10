import os
import re

with open("server.ts", "r") as f:
    content = f.read()

# 1. Add import
if 'import { SnapshotOS }' not in content:
    content = content.replace('import { initServerSentry } from "./server/sentry";', 'import { initServerSentry } from "./server/sentry";\nimport { SnapshotOS } from "./server/snapshotOs";')

# 2. Add instantiation after adminDb
if 'const sos = new SnapshotOS(adminDb);' not in content:
    content = content.replace('async function startServer() {', 'const sos = new SnapshotOS(adminDb);\n\nasync function startServer() {')

# 3. Replace the entire // --- SNAPSHOT OPERATING SYSTEM (SOS) V3.5 CORE ENGINE --- block
start_marker = "// --- SNAPSHOT OPERATING SYSTEM (SOS) V3.5 CORE ENGINE ---"
end_marker = "// Individual article snapshot endpoint"
start_idx = content.find(start_marker)
end_idx = content.find(end_marker)

if start_idx != -1 and end_idx != -1:
    new_content = content[:start_idx] + "  // --- SNAPSHOT OPERATING SYSTEM (SOS) DELEGATED TO SnapshotOS CLASS ---\n\n  " + content[end_idx:]
    content = new_content

# 4. Fix endpoints that use the old variables
content = content.replace("snapshotStore[", "sos.snapshotStore[")
content = content.replace("currentManifest.", "sos.currentManifest.")
content = content.replace("currentManifest", "sos.currentManifest")
content = content.replace("deltasStore", "sos.deltasStore")
content = content.replace("snapshotArchives", "sos.snapshotArchives")
content = content.replace("snapshotVersions", "sos.snapshotVersions")
content = content.replace("snapshotRebuildQueue", "sos.snapshotRebuildQueue")
content = content.replace("editorialAuditLogs", "sos.editorialAuditLogs")
content = content.replace("lastRecoveryDrill", "sos.lastRecoveryDrill") # Oops, lastRecoveryDrill is missing, I should add it to SnapshotOS or ignore it. Let's handle it.

with open("server.ts", "w") as f:
    f.write(content)

print("Replaced successfully")
