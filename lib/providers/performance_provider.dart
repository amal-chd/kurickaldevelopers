import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import '../data/models/performance_score_model.dart';
import '../providers/auth_provider.dart';
import '../core/tenant/tenant.dart';

// Performance scores live in Supabase (the web recalc engine writes them there).
// The mobile app previously read a Firestore `performance_scores` collection that
// the migration left empty — so scores, the leaderboard and badges all showed up
// blank. These providers now read Supabase.

final _supabase = Supabase.instance.client;

/// Map a Supabase performance_scores row → model. Prefers the full camelCase
/// `data` jsonb snapshot written by the recalc engine; falls back to the
/// individual snake_case columns for legacy rows that predate the snapshot.
PerformanceScoreModel _scoreFromRow(Map<String, dynamic> row) {
  final id = (row['id'] ?? row['user_id'] ?? '').toString();
  final data = row['data'];
  if (data is Map) {
    return PerformanceScoreModel.fromMap(Map<String, dynamic>.from(data), id);
  }
  return PerformanceScoreModel.fromMap(<String, dynamic>{
    'userId': row['user_id'],
    'totalTasksCompleted': row['total_tasks_completed'],
    'totalTasksAssigned': row['total_tasks_assigned'],
    'tasksCompletedOnTime': row['tasks_completed_on_time'],
    'tasksCompletedLate': row['tasks_completed_late'],
    'tasksOverdue': row['tasks_overdue'],
    'tasksRejected': row['tasks_rejected'],
    'qualityScore': row['quality_score'],
    'reliabilityScore': row['reliability_score'],
    'overallPerformanceIndex': row['overall_performance_index'],
    'avgCompletionHours': row['average_completion_time_hrs'],
  }, id);
}

// Individual member score (id == user_id on this table).
final performanceScoreProvider =
    StreamProvider.family<PerformanceScoreModel?, String>((ref, userId) {
  return _supabase
      .from('performance_scores')
      .stream(primaryKey: ['id'])
      .eq('id', userId)
      .tenantScoped().map((rows) => rows.isEmpty ? null : _scoreFromRow(rows.first));
});

// Current logged-in user's score.
final myPerformanceScoreProvider =
    StreamProvider<PerformanceScoreModel?>((ref) {
  final user = ref.watch(authStateProvider).value;
  if (user == null) return const Stream.empty();
  return _supabase
      .from('performance_scores')
      .stream(primaryKey: ['id'])
      .eq('id', user.uid)
      .tenantScoped().map((rows) => rows.isEmpty ? null : _scoreFromRow(rows.first));
});

// All scores for the leaderboard, highest OPI first.
final leaderboardProvider = StreamProvider<List<PerformanceScoreModel>>((ref) {
  return _supabase.from('performance_scores').stream(primaryKey: ['id']).tenantScoped().map((rows) {
    final list = rows.map(_scoreFromRow).toList();
    list.sort((a, b) => b.overallPerformanceIndex.compareTo(a.overallPerformanceIndex));
    return list;
  });
});
