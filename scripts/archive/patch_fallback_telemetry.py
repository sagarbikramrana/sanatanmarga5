import re

with open("src/lib/firebase.ts", "r") as f:
    content = f.read()

if "import { telemetry } from './telemetry';" not in content:
    content = content.replace("import { offlineQueue } from './offlineQueue';", "import { offlineQueue } from './offlineQueue';\nimport { telemetry } from './telemetry';")

# Patch getDocsWithCacheFallback
content = re.sub(
    r'export async function getDocsWithCacheFallback<T = DocumentData>\(q: Query<T>\): Promise<QuerySnapshot<T>> \{\s*try \{\s*// Try server first\s*const snapshot = await getDocs\(q\);\s*offlineQueue\.resetQuotaStatus\(\);\s*return snapshot;',
    r'''export async function getDocsWithCacheFallback<T = DocumentData>(q: Query<T>, queryName: string = "unnamed_query"): Promise<QuerySnapshot<T>> {
  try {
    const start = performance.now();
    const snapshot = await getDocs(q);
    const duration = performance.now() - start;
    telemetry.trackRead(queryName, duration, snapshot.metadata.fromCache ? 'cache' : 'network');
    offlineQueue.resetQuotaStatus();
    return snapshot;''',
    content
)

# Patch getDocWithCacheFallback
content = re.sub(
    r'export async function getDocWithCacheFallback<T = DocumentData>\(docRef: DocumentReference<T>\): Promise<DocumentSnapshot<T>> \{\s*try \{\s*const snapshot = await getDoc\(docRef\);\s*offlineQueue\.resetQuotaStatus\(\);\s*return snapshot;',
    r'''export async function getDocWithCacheFallback<T = DocumentData>(docRef: DocumentReference<T>, queryName: string = "unnamed_doc_query"): Promise<DocumentSnapshot<T>> {
  try {
    const start = performance.now();
    const snapshot = await getDoc(docRef);
    const duration = performance.now() - start;
    telemetry.trackRead(queryName, duration, snapshot.metadata.fromCache ? 'cache' : 'network');
    offlineQueue.resetQuotaStatus();
    return snapshot;''',
    content
)

with open("src/lib/firebase.ts", "w") as f:
    f.write(content)
