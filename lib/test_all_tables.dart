import 'package:supabase/supabase.dart';
import 'package:task_pilot/core/config/supabase_config.dart';

void main() async {
  final client = SupabaseClient(SupabaseConfig.url, SupabaseConfig.anonKey);
  
  final tables = [
    'audit_logs', 'broadcast_notifications', 'invitations', 'projects', 'roles',
    'settings', 'tasks', 'users', 'chat_channels', 'chat_messages', 'chat_typing',
    'notifications', 'comments', 'subtasks', 'time_logs', 'attendance', 'documents',
    'site_diaries', 'milestones'
  ];
  
  for (final table in tables) {
    try {
      await client.from(table).select().limit(1);
      print('SUCCESS: $table');
    } catch (e) {
      if (e is PostgrestException && e.code == 'PGRST205') {
        print('MISSING TABLE: $table');
      } else {
        print('ERROR ON $table: $e');
      }
    }
  }
}
