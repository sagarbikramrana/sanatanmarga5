import re

with open("server.ts", "r") as f:
    content = f.read()

# Add import
if 'import compression from "compression";' not in content:
    content = content.replace('import express from "express";', 'import express from "express";\nimport compression from "compression";')

# Add middleware
if 'app.use(compression())' not in content:
    content = content.replace('const app = express();', 'const app = express();\n\n  // Snapshot Compression (Gzip/Brotli)\n  app.use(compression());')

with open("server.ts", "w") as f:
    f.write(content)

print("Compression added")
