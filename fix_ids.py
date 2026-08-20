import os
import re

repos_dir = '/Users/amalchand/Desktop/kurickaldevelopers/mobile_app/lib/data/repositories'

for file in os.listdir(repos_dir):
    if not file.endswith('.dart'):
        continue
    filepath = os.path.join(repos_dir, file)
    with open(filepath, 'r') as f:
        content = f.read()
    
    modified = False
    if "import 'package:uuid/uuid.dart';" not in content and "_supabase.from" in content and ".insert(" in content:
        content = "import 'package:uuid/uuid.dart';\n" + content
        modified = True
        
    # Replace common patterns
    if re.search(r"final result = await _supabase\.from\('tasks'\)\.insert\(data\)", content):
        content = re.sub(
            r"final result = await _supabase\.from\('tasks'\)\.insert\(data\)",
            r"data['id'] = const Uuid().v4();\n      final result = await _supabase.from('tasks').insert(data)",
            content
        )
        modified = True
        
    if re.search(r"await _supabase\.from\('subtasks'\)\.insert\(data\);", content):
        content = re.sub(
            r"await _supabase\.from\('subtasks'\)\.insert\(data\);",
            r"data['id'] = const Uuid().v4();\n      await _supabase.from('subtasks').insert(data);",
            content
        )
        modified = True

    if re.search(r"await _supabase\.from\('comments'\)\.insert\(data\);", content):
        content = re.sub(
            r"await _supabase\.from\('comments'\)\.insert\(data\);",
            r"data['id'] = const Uuid().v4();\n      await _supabase.from('comments').insert(data);",
            content
        )
        modified = True

    if re.search(r"await _supabase\.from\('app_notifications'\)\.insert\(\{", content):
        content = re.sub(
            r"await _supabase\.from\('app_notifications'\)\.insert\(\{",
            r"await _supabase.from('app_notifications').insert({\n        'id': const Uuid().v4(),",
            content
        )
        modified = True

    if re.search(r"final msgRef = await _supabase\.from\('chat_messages'\)\.insert\(msgData\)", content):
        content = re.sub(
            r"final msgRef = await _supabase\.from\('chat_messages'\)\.insert\(msgData\)",
            r"msgData['id'] = const Uuid().v4();\n      final msgRef = await _supabase.from('chat_messages').insert(msgData)",
            content
        )
        modified = True
        
    if re.search(r"final inserted = await _supabase\.from\('chat_channels'\)\.insert\(data\)", content):
        content = re.sub(
            r"final inserted = await _supabase\.from\('chat_channels'\)\.insert\(data\)",
            r"data['id'] = const Uuid().v4();\n      final inserted = await _supabase.from('chat_channels').insert(data)",
            content
        )
        modified = True
        
    if modified:
        with open(filepath, 'w') as f:
            f.write(content)
