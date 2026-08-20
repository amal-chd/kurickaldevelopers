import re

with open('/Users/amalchand/Desktop/kurickaldevelopers/mobile_app/lib/data/repositories/task_repository.dart', 'r') as f:
    content = f.read()

# Add Firestore import if not there
if "import 'package:cloud_firestore/cloud_firestore.dart';" not in content:
    content = "import 'package:cloud_firestore/cloud_firestore.dart';\n" + content

# Fix users queries
content = re.sub(
    r"await _supabase\.from\('users'\)\s*\.select\(\)\s*\.eq\('role_id',\s*([^)]+)\)\s*\.eq\('is_active',\s*true\);",
    r"(await FirebaseFirestore.instance.collection('users').where('roleId', isEqualTo: \1).where('isActive', isEqualTo: true).get()).docs.map((d) => d.data()..['id'] = d.id).toList();",
    content
)

content = re.sub(
    r"await _supabase\.from\('users'\)\s*\.select\(\)\s*\.eq\('id',\s*([^)]+)\)\s*\.maybeSingle\(\);",
    r"await FirebaseFirestore.instance.collection('users').doc(\1).get().then((d) => d.exists ? (d.data()!..['id'] = d.id) : null);",
    content
)

content = re.sub(
    r"await _supabase\.from\('users'\)\s*\.select\(\)\s*\.inFilter\('role_id',\s*([^)]+)\);",
    r"(await FirebaseFirestore.instance.collection('users').where('roleId', whereIn: \1).get()).docs.map((d) => d.data()..['id'] = d.id).toList();",
    content
)

# Fix time_logs
content = re.sub(
    r"return _supabase\.from\('time_logs'\)\.stream\(primaryKey: \['id'\]\)\.eq\('task_id',\s*([^)]+)\)\s*\.order\('start_time',\s*ascending:\s*false\)\s*\.map\(\(list\)\s*=>\s*list\.map\(\(data\)\s*=>\s*TimeLogModel\.fromMap\(_toCamelCase\(data\),\s*data\['id'\]\)\)\.toList\(\)\)\s*\.handleError\(\(e\)\s*=>\s*throw\s*ErrorTranslator\.translate\(e\)\);",
    r"return FirebaseFirestore.instance.collection('tasks').doc(\1).collection('timeLogs').orderBy('startTime', descending: true).snapshots().map((s) => s.docs.map((d) => TimeLogModel.fromMap(d.data(), d.id)).toList()).handleError((e) => throw ErrorTranslator.translate(e));",
    content
)

content = re.sub(
    r"final result = await _supabase\.from\('time_logs'\)\.insert\(data\)\.select\(\)\.single\(\);",
    r"final result = await FirebaseFirestore.instance.collection('tasks').doc(data['task_id']).collection('timeLogs').add(data); data['id'] = result.id;",
    content
)

content = re.sub(
    r"await _supabase\.from\('time_logs'\)\.update\(\{([^}]+)\}\)\.eq\('id',\s*([^)]+)\);",
    r"await FirebaseFirestore.instance.collection('tasks').doc(taskId).collection('timeLogs').doc(\2).update({\1});",
    content
)

with open('/Users/amalchand/Desktop/kurickaldevelopers/mobile_app/lib/data/repositories/task_repository.dart', 'w') as f:
    f.write(content)
