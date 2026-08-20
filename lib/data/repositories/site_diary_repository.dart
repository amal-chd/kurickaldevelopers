import 'package:cloud_firestore/cloud_firestore.dart';
import '../models/site_diary_model.dart';
import '../../core/utils/date_utils.dart';
import '../../core/utils/error_translator.dart';
import '../services/push_sender.dart';

class SiteDiaryRepository {
  final _db = FirebaseFirestore.instance;

  CollectionReference get _diaries => _db.collection('site_diaries');

  Stream<List<SiteDiaryModel>> watchProjectDiaries(String projectId) {
    return _diaries
        .where('projectId', isEqualTo: projectId)
        .orderBy('date', descending: true)
        .snapshots()
        .map((s) => s.docs.map(SiteDiaryModel.fromFirestore).toList())
        .handleError((e) => throw ErrorTranslator.translate(e));
  }

  Future<SiteDiaryModel?> getEntryForDate(
    String projectId,
    String authorId,
    String date,
  ) async {
    try {
      final snap = await _diaries
          .where('projectId', isEqualTo: projectId)
          .where('authorId', isEqualTo: authorId)
          .where('date', isEqualTo: date)
          .limit(1)
          .get();
      if (snap.docs.isEmpty) return null;
      return SiteDiaryModel.fromFirestore(snap.docs.first);
    } catch (e) {
      throw ErrorTranslator.translate(e);
    }
  }

  Future<SiteDiaryModel?> getTodayEntry(
    String projectId,
    String authorId,
  ) async {
    return getEntryForDate(
      projectId,
      authorId,
      AppDateUtils.toYMD(DateTime.now()),
    );
  }

  Future<String> createEntry(SiteDiaryModel entry) async {
    try {
      final doc = await _diaries.add(entry.toFirestore());
      PushSender.instance.diaryEntry(diaryId: doc.id);
      return doc.id;
    } catch (e) {
      throw ErrorTranslator.translate(e);
    }
  }

  Future<void> updateEntry(String id, Map<String, dynamic> data) async {
    try {
      data['updatedAt'] = AppDateUtils.toTimestamp(DateTime.now());
      await _diaries.doc(id).update(data);
    } catch (e) {
      throw ErrorTranslator.translate(e);
    }
  }
}
