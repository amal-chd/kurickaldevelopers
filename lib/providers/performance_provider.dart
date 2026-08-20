import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import '../data/models/performance_score_model.dart';
import '../providers/auth_provider.dart';

final firestoreProvider = Provider<FirebaseFirestore>((ref) => FirebaseFirestore.instance);

// Stream of individual member score
final performanceScoreProvider = StreamProvider.family<PerformanceScoreModel?, String>((ref, userId) {
  final firestore = ref.watch(firestoreProvider);
  return firestore
      .collection('performance_scores')
      .doc(userId)
      .snapshots()
      .map((doc) => doc.exists ? PerformanceScoreModel.fromMap(doc.data() as Map<String, dynamic>, doc.id) : null);
});

// Stream of current logged-in user's score (observes snapshots directly to avoid deprecated .stream)
final myPerformanceScoreProvider = StreamProvider<PerformanceScoreModel?>((ref) {
  final authState = ref.watch(authStateProvider);
  final user = authState.value;
  if (user == null) {
    return const Stream.empty();
  }
  final firestore = ref.watch(firestoreProvider);
  return firestore
      .collection('performance_scores')
      .doc(user.uid)
      .snapshots()
      .map((doc) => doc.exists ? PerformanceScoreModel.fromMap(doc.data() as Map<String, dynamic>, doc.id) : null);
});

// Stream of all scores (for leaderboards) sorted by OPI descending
final leaderboardProvider = StreamProvider<List<PerformanceScoreModel>>((ref) {
  final firestore = ref.watch(firestoreProvider);
  return firestore
      .collection('performance_scores')
      .snapshots()
      .map((snap) {
        final list = snap.docs.map((doc) => PerformanceScoreModel.fromMap(doc.data() as Map<String, dynamic>, doc.id)).toList();
        list.sort((a, b) => (b.overallPerformanceIndex ?? 0.0).compareTo(a.overallPerformanceIndex ?? 0.0));
        return list;
      });
});
