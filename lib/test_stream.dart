import 'package:supabase/supabase.dart';
import 'package:task_pilot/core/config/supabase_config.dart';

void main() async {
  final client = SupabaseClient(SupabaseConfig.url, SupabaseConfig.anonKey);
  
  try {
    print('Testing attendance stream...');
    final s = client.from('attendance').stream(primaryKey: ['id']).limit(1);
    final res = await s.first;
    print('Attendance stream: $res');
  } catch (e) {
    print('ATTENDANCE STREAM ERR: $e');
  }

  try {
    print('Testing chat_channels stream...');
    final s = client.from('chat_channels').stream(primaryKey: ['id']).limit(1);
    final res = await s.first;
    print('Chats stream: $res');
  } catch (e) {
    print('CHATS STREAM ERR: $e');
  }
}
