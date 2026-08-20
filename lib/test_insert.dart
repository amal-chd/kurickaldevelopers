import 'package:supabase/supabase.dart';
import 'package:task_pilot/core/config/supabase_config.dart';

void main() async {
  final client = SupabaseClient(SupabaseConfig.url, SupabaseConfig.anonKey);
  try {
    final res = await client.from('chat_messages').insert({
      'channel_id': 'test',
      'sender_id': 'test',
      'text': 'test',
      'type': 'text',
      'created_at': DateTime.now().toIso8601String()
    }).select().single();
    print('Inserted: $res');
  } catch(e) { print('ERR: $e'); }
}
