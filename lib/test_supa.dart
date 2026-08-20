import 'package:supabase/supabase.dart';
import 'package:task_pilot/core/config/supabase_config.dart';

void main() async {
  final client = SupabaseClient(SupabaseConfig.url, SupabaseConfig.anonKey);
  
  try {
    print('Testing attendance...');
    final res = await client.from('attendance').select().limit(1);
    print('Attendance: $res');
  } catch (e) {
    print('ATTENDANCE ERR: $e');
  }

  try {
    print('Testing projects...');
    final res = await client.from('projects').select().limit(1);
    print('Projects: $res');
  } catch (e) {
    print('PROJECTS ERR: $e');
  }

  try {
    print('Testing project_milestones...');
    final res = await client.from('project_milestones').select().limit(1);
    print('Milestones: $res');
  } catch (e) {
    print('MILESTONES ERR: $e');
  }
}
