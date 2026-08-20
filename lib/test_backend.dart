import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:task_pilot/core/config/supabase_config.dart';
import 'package:task_pilot/data/repositories/attendance_repository.dart';
import 'package:task_pilot/data/repositories/project_repository.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await Supabase.initialize(
    url: SupabaseConfig.url,
    anonKey: SupabaseConfig.anonKey,
  );
  
  print('--- Testing Attendance ---');
  final attRepo = AttendanceRepository();
  attRepo.watchTodayProjectAttendance('test').listen((data) {
    print('Attendance success: \${data.length}');
  }, onError: (e, st) {
    print('ATTENDANCE ERROR: \$e\\n\$st');
  });

  print('--- Testing Project ---');
  final projRepo = ProjectRepository();
  projRepo.watchProjects().listen((data) {
    print('Project success: \${data.length}');
  }, onError: (e, st) {
    print('PROJECT ERROR: \$e\\n\$st');
  });
  
  await Future.delayed(Duration(seconds: 3));
}
