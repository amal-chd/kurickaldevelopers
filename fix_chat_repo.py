import re

with open('/Users/amalchand/Desktop/kurickaldevelopers/mobile_app/lib/data/repositories/chat_repository.dart', 'r') as f:
    content = f.read()

if "import 'package:cloud_firestore/cloud_firestore.dart';" not in content:
    content = "import 'package:cloud_firestore/cloud_firestore.dart';\n" + content

content = re.sub(
    r"await _supabase\.from\('users'\)\s*\.select\(\)\s*\.eq\('id',\s*([^)]+)\)\s*\.maybeSingle\(\);",
    r"await FirebaseFirestore.instance.collection('users').doc(\1).get().then((d) => d.exists ? (d.data()!..['id'] = d.id) : null);",
    content
)

with open('/Users/amalchand/Desktop/kurickaldevelopers/mobile_app/lib/data/repositories/chat_repository.dart', 'w') as f:
    f.write(content)
