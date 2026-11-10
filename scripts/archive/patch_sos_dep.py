import re

with open("server/snapshotOs.ts", "r") as f:
    content = f.read()

# Add dependency logic
dep_logic = """
    let buildHomepage = true;
    let buildArticles = true;
    let buildCategories = true;
    let buildKnowledge = true;
    let buildCommunity = true;
    let buildSearch = true;
    let buildNepalHub = true;

    if (job.triggerEntity) {
      const entityType = job.triggerEntity.split('_')[0];
      if (entityType === 'article') {
        buildKnowledge = false;
        buildCommunity = false;
        buildNepalHub = false;
      } else if (entityType === 'knowledge') {
        buildHomepage = false;
        buildArticles = false;
        buildCategories = false;
        buildCommunity = false;
        buildNepalHub = false;
      } else if (entityType === 'community') {
        buildHomepage = false;
        buildArticles = false;
        buildCategories = false;
        buildKnowledge = false;
        buildNepalHub = false;
      } else if (entityType === 'nepalhub') {
        buildHomepage = false;
        buildArticles = false;
        buildCategories = false;
        buildKnowledge = false;
        buildCommunity = false;
      }
    }
"""

target = "let categories: any[] = [];"
if "let buildHomepage" not in content:
    content = content.replace(target, dep_logic + "\n    " + target)

with open("server/snapshotOs.ts", "w") as f:
    f.write(content)

print("Dependencies patched")
