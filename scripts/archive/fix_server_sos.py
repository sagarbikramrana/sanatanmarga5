import re

with open("server.ts", "r") as f:
    content = f.read()

# Fix double sos.sos.
content = content.replace("sos.sos.", "sos.")

# Fix missing sos. prefix
content = re.sub(r'(?<!sos\.)\bsnapshotStore\b', 'sos.snapshotStore', content)
content = re.sub(r'(?<!sos\.)\bcurrentManifest\b', 'sos.currentManifest', content)
content = re.sub(r'(?<!sos\.)\bdeltasStore\b', 'sos.deltasStore', content)
content = re.sub(r'(?<!sos\.)\bsnapshotArchives\b', 'sos.snapshotArchives', content)
content = re.sub(r'(?<!sos\.)\bsnapshotVersions\b', 'sos.snapshotVersions', content)
content = re.sub(r'(?<!sos\.)\bsnapshotRebuildQueue\b', 'sos.snapshotRebuildQueue', content)
content = re.sub(r'(?<!sos\.)\beditorialAuditLogs\b', 'sos.editorialAuditLogs', content)
content = re.sub(r'(?<!sos\.)\blastRecoveryDrill\b', 'sos.lastRecoveryDrill', content)

# Fix logAudit calls
content = re.sub(r'\blogAudit\(', 'sos.logAudit(', content)

# Fix compileSnapshotOS call
content = re.sub(r'\bcompileSnapshotOS\(', 'sos.queueRebuild(', content)

with open("server.ts", "w") as f:
    f.write(content)

print("Server sos fixed")
