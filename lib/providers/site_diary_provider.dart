import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../data/models/site_diary_model.dart';
import '../data/repositories/site_diary_repository.dart';

final siteDiaryRepositoryProvider = Provider<SiteDiaryRepository>(
  (ref) => SiteDiaryRepository(),
);

final projectDiariesProvider =
    StreamProvider.family<List<SiteDiaryModel>, String>((ref, projectId) {
      return ref
          .watch(siteDiaryRepositoryProvider)
          .watchProjectDiaries(projectId);
    });
