#!/bin/bash
cat << 'REPLACE_SCRIPT' > replace_ads.py
import re

def replace_file(path, from_str, to_str):
    with open(path, "r") as f:
        content = f.read()
    
    content = content.replace("onSnapshot", "getDocs")
    # Custom fix based on how to query ads
    with open(path, "w") as f:
        f.write(content)
REPLACE_SCRIPT
# Let's do it manually via python
