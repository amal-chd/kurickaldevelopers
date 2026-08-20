import re

with open('/Users/amalchand/Desktop/kurickaldevelopers/mobile_app/lib/data/repositories/attendance_repository.dart', 'r') as f:
    content = f.read()

content = re.sub(
    r"if \(value == null\) return;",
    r"if (value == null) { map[key.replaceAllMapped(RegExp(r'[A-Z]'), (match) => '_' + match.group(0)!.toLowerCase())] = null; return; }",
    content
)

with open('/Users/amalchand/Desktop/kurickaldevelopers/mobile_app/lib/data/repositories/attendance_repository.dart', 'w') as f:
    f.write(content)
