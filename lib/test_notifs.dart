import 'package:supabase/supabase.dart';
import 'package:task_pilot/core/config/supabase_config.dart';
void main() async {
  final client = SupabaseClient(SupabaseConfig.url, SupabaseConfig.anonKey);
  try {
    final res = await client.from('app_notifications').select().limit(1);
    print('app_notifications: $res');
  } catch(e) { print(e); }
  try {
    final res = await client.from('notifications').select().limit(1);
    print('notifications: $res');
  } catch(e) { print(e); }
}
