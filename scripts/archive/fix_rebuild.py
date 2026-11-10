import re

with open("server.ts", "r") as f:
    content = f.read()

content = content.replace('const result = await sos.queueRebuild(triggerSource || "admin_manual");\n      res.json(result);', 'const jobId = await sos.queueRebuild(triggerSource || "admin_manual");\n      res.json({ success: true, jobId });')

with open("server.ts", "w") as f:
    f.write(content)

print("Rebuild fixed")
