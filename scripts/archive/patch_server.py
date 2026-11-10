import re

with open("server.ts", "r") as f:
    content = f.read()

# Replace getDocs with trackedGetDocs
# We will create a local memory tracker in server.ts
tracker = """
// Simple memory telemetry tracker for server
const serverTelemetry: Record<string, any> = {};
async function trackedGetDocs(queryName: string, q: any) {
  const start = Date.now();
  const snap = await getDocs(q);
  const duration = Date.now() - start;
  
  if (!serverTelemetry[queryName]) {
    serverTelemetry[queryName] = { queryName, count: 0, lastTimestamp: 0, source: 'network', avgDuration: 0 };
  }
  const m = serverTelemetry[queryName];
  m.count += 1;
  m.lastTimestamp = Date.now();
  m.avgDuration = ((m.avgDuration * (m.count - 1)) + duration) / m.count;
  return snap;
}
"""

if "const serverTelemetry" not in content:
    content = content.replace('const app = express();', tracker + '\nconst app = express();')

content = content.replace('const layoutSnap = await getDocs(query(collection(db, "settings")));', 'const layoutSnap = await trackedGetDocs("homepage_settings", query(collection(db, "settings")));')
content = content.replace('const categoriesSnap = await getDocs(query(collection(db, "categories"), orderBy("order", "asc")));', 'const categoriesSnap = await trackedGetDocs("homepage_categories", query(collection(db, "categories"), orderBy("order", "asc")));')
content = content.replace('const artSnap = await getDocs(artQ);', 'const artSnap = await trackedGetDocs("homepage_category_articles", artQ);')
content = content.replace('const featuredSnap = await getDocs(featuredQ);', 'const featuredSnap = await trackedGetDocs("homepage_featured", featuredQ);')
content = content.replace('const latestSnap = await getDocs(latestQ);', 'const latestSnap = await trackedGetDocs("homepage_latest", latestQ);')
content = content.replace('const videoSnap = await getDocs(videoQ);', 'const videoSnap = await trackedGetDocs("homepage_video", videoQ);')
content = content.replace('const mostReadSnap = await getDocs(mostReadQ);', 'const mostReadSnap = await trackedGetDocs("homepage_most_read", mostReadQ);')

# Add endpoint to fetch server telemetry
telemetry_api = """
  app.get("/api/system/telemetry", (req, res) => {
    res.json(Object.values(serverTelemetry));
  });
"""
if "/api/system/telemetry" not in content:
    content = content.replace('  app.get("/api/system/metrics", async (req, res) => {', telemetry_api + '\n  app.get("/api/system/metrics", async (req, res) => {')

with open("server.ts", "w") as f:
    f.write(content)
