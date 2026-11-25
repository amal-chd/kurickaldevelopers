import re
import os

with open('src/lib/firestore.ts', 'r') as f:
    content = f.read()

# Header goes up to the first "// ───"
header_match = re.search(r'// ───', content)
header = content[:header_match.start()] if header_match else content

sections = {}
current_section = None
current_content = []

lines = content.split('\n')
for line in lines:
    match = re.match(r'^// ─── (.*?) ─+$', line)
    if match:
        if current_section:
            sections[current_section] = '\n'.join(current_content)
        current_section = match.group(1).strip()
        current_content = [line]
    elif current_section:
        current_content.append(line)

if current_section:
    sections[current_section] = '\n'.join(current_content)

os.makedirs('src/lib/db', exist_ok=True)

# Write header to a common file if needed, or inject it into each split file.
# We'll just write each section to a raw file for now, we'll manually fix imports later.
for name, data in sections.items():
    filename = name.lower().replace(' ', '_').replace('(', '').replace(')', '').replace('&', 'and') + '.ts'
    with open(f'src/lib/db/{filename}', 'w') as f:
        f.write(header + '\n' + data)
        
print("Split complete")
