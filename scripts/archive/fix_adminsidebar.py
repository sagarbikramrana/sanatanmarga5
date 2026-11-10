with open("src/components/layout/AdminSidebar.tsx", "r") as f:
    content = f.read()

import re
content = re.sub(r'setSettings\(prev => \(\{ \.\.\.prev, \.\.\.docSnap\.data\(\) \}\)\);', r'''const data = docSnap.data();
          if (data.logoUrl) setLogoUrl(data.logoUrl);
          if (data.logoVerticalUrl) setLogoVerticalUrl(data.logoVerticalUrl);''', content)

with open("src/components/layout/AdminSidebar.tsx", "w") as f:
    f.write(content)
