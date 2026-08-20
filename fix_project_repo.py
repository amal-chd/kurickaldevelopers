import re

with open('/Users/amalchand/Desktop/kurickaldevelopers/mobile_app/lib/data/repositories/project_repository.dart', 'r') as f:
    content = f.read()

if "import 'package:cloud_firestore/cloud_firestore.dart';" not in content:
    content = "import 'package:cloud_firestore/cloud_firestore.dart';\n" + content

# Fix milestones queries
content = re.sub(
    r"return _supabase\.from\(_milestones\)\.stream\(primaryKey: \['id'\]\)\.eq\('project_id',\s*projectId\)\.order\('due_date'\)\s*\.map\(\(list\)\s*=>\s*list\.map\(\(data\)\s*=>\s*MilestoneModel\.fromMap\(_toCamelCase\(data\),\s*data\['id'\]\)\)\.toList\(\)\)\s*\.handleError\(\(e\)\s*=>\s*throw\s*ErrorTranslator\.translate\(e\)\);",
    r"return FirebaseFirestore.instance.collection('projects').doc(projectId).collection('milestones').orderBy('dueDate').snapshots().map((s) => s.docs.map((d) => MilestoneModel.fromMap(d.data(), d.id)).toList()).handleError((e) => throw ErrorTranslator.translate(e));",
    content
)

content = re.sub(
    r"final data = await _supabase\.from\(_milestones\)\.insert\(map\)\.select\('id'\)\.single\(\);\s*return data\['id'\];",
    r"final ref = await FirebaseFirestore.instance.collection('projects').doc(projectId).collection('milestones').add(map); return ref.id;",
    content
)

content = re.sub(
    r"await _supabase\.from\(_milestones\)\.update\(_toSnakeCase\(data\)\)\.eq\('id',\s*milestoneId\)\.eq\('project_id',\s*projectId\);",
    r"await FirebaseFirestore.instance.collection('projects').doc(projectId).collection('milestones').doc(milestoneId).update(data);",
    content
)

content = re.sub(
    r"try \{\s*await _supabase\.from\(_milestones\)\.delete\(\)\.eq\('project_id',\s*projectId\);\s*\} catch \(_\) \{\}",
    r"",
    content
)

with open('/Users/amalchand/Desktop/kurickaldevelopers/mobile_app/lib/data/repositories/project_repository.dart', 'w') as f:
    f.write(content)
