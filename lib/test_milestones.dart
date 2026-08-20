import 'package:supabase/supabase.dart';
import 'package:task_pilot/core/config/supabase_config.dart';
void main() async {
  final client = SupabaseClient(SupabaseConfig.url, SupabaseConfig.anonKey);
  try {
    print('Testing milestones...');
    final res = await client.from('milestones').select().limit(1);
    print('Milestones: $res');
  } catch (e) {
    print('MILESTONES ERR: $e');
  }
}
