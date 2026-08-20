import 'dart:io';
import 'package:supabase/supabase.dart';

void main() async {
  final supabase = SupabaseClient(
    Platform.environment['VITE_SUPABASE_URL']!,
    Platform.environment['VITE_SUPABASE_ANON_KEY']!
  );
  
  final data = {
    'id': 'test_dart_checkin_123',
    'user_id': '123',
    'date': '2026-08-20',
    'check_in_time': DateTime.now().toIso8601String(),
    'check_in_location': {'lat': 10.0, 'lng': 76.0},
    'project_id': 'test_proj'
  };
  
  try {
    await supabase.from('attendance').insert(data);
    print("SUCCESS!");
  } catch (e) {
    print("ERROR: $e");
  }
  exit(0);
}
