import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../data/models/document_model.dart';
import '../data/repositories/document_repository.dart';

final documentRepositoryProvider = Provider<DocumentRepository>(
  (ref) => DocumentRepository(),
);

final projectDocumentsProvider =
    StreamProvider.family<List<DocumentModel>, String>((ref, projectId) {
      return ref
          .watch(documentRepositoryProvider)
          .watchProjectDocuments(projectId);
    });

final documentProvider = StreamProvider.family<DocumentModel?, String>((
  ref,
  docId,
) {
  return ref.watch(documentRepositoryProvider).watchDocument(docId);
});
