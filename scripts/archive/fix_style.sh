#!/bin/bash
cat << 'REPLACE_SCRIPT' > replace_style2.py
import re

with open("src/components/StyleProvider.tsx", "r") as f:
    content = f.read()

# Let's restore from git and do it properly, or just rewrite it
REPLACE_SCRIPT
git checkout src/components/StyleProvider.tsx
