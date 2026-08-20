import re

with open('/Users/amalchand/Desktop/kurickaldevelopers/mobile_app/lib/data/repositories/admin_repository.dart', 'r') as f:
    content = f.read()

# audit_logs
content = re.sub(
    r"await _supabase\.from\('audit_logs'\)\.insert\(_toSnakeCase\(doc\)\);",
    r"await FirebaseFirestore.instance.collection('audit_logs').add(doc);",
    content
)

content = re.sub(
    r"return _supabase\.from\('audit_logs'\)\.stream\(primaryKey: \['id'\]\)\.order\('timestamp',\s*ascending:\s*false\)\.limit\(limit\)\s*\.map\(\(list\)\s*=>\s*list\.map\(\(data\)\s*=>\s*AuditLogEntry\.fromMap\(_toCamelCase\(data\),\s*data\['id'\]\)\)\.toList\(\)\)\s*\.handleError\(\(e\)\s*=>\s*throw\s*ErrorTranslator\.translate\(e\)\);",
    r"return FirebaseFirestore.instance.collection('audit_logs').orderBy('timestamp', descending: true).limit(limit).snapshots().map((s) => s.docs.map((d) => AuditLogEntry.fromMap(d.data(), d.id)).toList()).handleError((e) => throw ErrorTranslator.translate(e));",
    content
)

content = re.sub(
    r"return _supabase\.from\('audit_logs'\)\.stream\(primaryKey: \['id'\]\)\.eq\('target_type',\s*targetType\)\.order\('timestamp',\s*ascending:\s*false\)\.limit\(50\)\s*\.map\(\(list\)\s*=>\s*list\.map\(\(data\)\s*=>\s*AuditLogEntry\.fromMap\(_toCamelCase\(data\),\s*data\['id'\]\)\)\.toList\(\)\)\s*\.handleError\(\(e\)\s*=>\s*throw\s*ErrorTranslator\.translate\(e\)\);",
    r"return FirebaseFirestore.instance.collection('audit_logs').where('targetType', isEqualTo: targetType).orderBy('timestamp', descending: true).limit(50).snapshots().map((s) => s.docs.map((d) => AuditLogEntry.fromMap(d.data(), d.id)).toList()).handleError((e) => throw ErrorTranslator.translate(e));",
    content
)

# invitations
content = re.sub(
    r"final data = await _supabase\.from\('invitations'\)\.insert\(_toSnakeCase\(inv\.toMap\(\)\)\)\.select\('id'\)\.single\(\);\s*return data\['id'\] as String;",
    r"final ref = await FirebaseFirestore.instance.collection('invitations').add(inv.toMap()); return ref.id;",
    content
)

content = re.sub(
    r"return _supabase\.from\('invitations'\)\.stream\(primaryKey: \['id'\]\)\.eq\('status',\s*'pending'\)\.order\('invited_at',\s*ascending:\s*false\)\s*\.map\(\(list\)\s*=>\s*list\.map\(\(data\)\s*=>\s*UserInvitation\.fromMap\(_toCamelCase\(data\),\s*data\['id'\]\)\)\.toList\(\)\)\s*\.handleError\(\(e\)\s*=>\s*throw\s*ErrorTranslator\.translate\(e\)\);",
    r"return FirebaseFirestore.instance.collection('invitations').where('status', isEqualTo: 'pending').orderBy('invitedAt', descending: true).snapshots().map((s) => s.docs.map((d) => UserInvitation.fromMap(d.data(), d.id)).toList()).handleError((e) => throw ErrorTranslator.translate(e));",
    content
)

content = re.sub(
    r"await _supabase\.from\('invitations'\)\.update\(\{'status':\s*'cancelled'\}\)\.eq\('id',\s*invId\);",
    r"await FirebaseFirestore.instance.collection('invitations').doc(invId).update({'status': 'cancelled'});",
    content
)

# broadcast_notifications
content = re.sub(
    r"await _supabase\.from\('broadcast_notifications'\)\.insert\(\{([^}]+)\}\);",
    r"await FirebaseFirestore.instance.collection('broadcast_notifications').add({\1});",
    content
)

content = re.sub(
    r"return _supabase\.from\('broadcast_notifications'\)\.stream\(primaryKey: \['id'\]\)\.order\('sent_at',\s*ascending:\s*false\)\.limit\(limit\)\s*\.map\(\(list\)\s*=>\s*list\.map\(\(d\)\s*=>\s*_toCamelCase\(d\)\)\.toList\(\)\)\s*\.handleError\(\(e\)\s*=>\s*throw\s*ErrorTranslator\.translate\(e\)\);",
    r"return FirebaseFirestore.instance.collection('broadcast_notifications').orderBy('sentAt', descending: true).limit(limit).snapshots().map((s) => s.docs.map((d) => d.data()..['id'] = d.id).toList()).handleError((e) => throw ErrorTranslator.translate(e));",
    content
)

# users (Rx.combineLatest)
content = content.replace("_supabase.from('users').stream(primaryKey: ['id']),", "FirebaseFirestore.instance.collection('users').snapshots().map((s) => s.docs.map((d) => d.data()..['id'] = d.id).toList()),")
content = content.replace("_supabase.from('users').stream(primaryKey: ['id']).eq('is_active', true),", "FirebaseFirestore.instance.collection('users').where('isActive', isEqualTo: true).snapshots().map((s) => s.docs.map((d) => d.data()..['id'] = d.id).toList()),")

with open('/Users/amalchand/Desktop/kurickaldevelopers/mobile_app/lib/data/repositories/admin_repository.dart', 'w') as f:
    f.write(content)
