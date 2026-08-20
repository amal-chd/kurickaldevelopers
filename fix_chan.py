import re

with open('/Users/amalchand/Desktop/kurickaldevelopers/mobile_app/lib/data/repositories/chat_repository.dart', 'r') as f:
    content = f.read()

replacement = """
    if (['description', 'projectId', 'iconEmoji', 'adminIds', 'createdBy'].contains(key)) return;
"""

content = re.sub(
    r"final snakeKey = key\.replaceAllMapped\(RegExp\(r'\[A-Z\]'\), \(match\) => '_' \+ match\.group\(0\)!\.toLowerCase\(\)\);",
    replacement + "\n    final snakeKey = key.replaceAllMapped(RegExp(r'[A-Z]'), (match) => '_' + match.group(0)!.toLowerCase());",
    content
)

with open('/Users/amalchand/Desktop/kurickaldevelopers/mobile_app/lib/data/repositories/chat_repository.dart', 'w') as f:
    f.write(content)
