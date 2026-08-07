import 'package:cloud_firestore/cloud_firestore.dart';
import '../models/document_model.dart';
import '../../core/utils/error_translator.dart';

class DocumentRepository {
  final _db = FirebaseFirestore.instance;

  CollectionReference get _docs => _db.collection('documents');

  Stream<List<DocumentModel>> watchProjectDocuments(String projectId) {
    return _docs
        .where('projectId', isEqualTo: projectId)
        .orderBy('uploadedAt', descending: true)
        .snapshots()
        .map((s) => s.docs.map(DocumentModel.fromFirestore).toList())
        .handleError((e) => throw ErrorTranslator.translate(e));
  }

  Stream<DocumentModel?> watchDocument(String docId) {
    return _docs
        .doc(docId)
        .snapshots()
        .map((doc) {
          if (!doc.exists) return null;
          return DocumentModel.fromFirestore(doc);
        })
        .handleError((e) => throw ErrorTranslator.translate(e));
  }

  Future<String> createDocument(DocumentModel document) async {
    try {
      final doc = await _docs.add(document.toFirestore());
      return doc.id;
    } catch (e) {
      throw ErrorTranslator.translate(e);
    }
  }

  Future<void> updateDocument(String docId, Map<String, dynamic> data) async {
    try {
      await _docs.doc(docId).update(data);
    } catch (e) {
      throw ErrorTranslator.translate(e);
    }
  }

  Future<void> deleteDocument(String docId) async {
    try {
      await _docs.doc(docId).delete();
    } catch (e) {
      throw ErrorTranslator.translate(e);
    }
  }

  Future<List<DocumentModel>> getDocumentsByName(
    String projectId,
    String name,
  ) async {
    try {
      final snap = await _docs
          .where('projectId', isEqualTo: projectId)
          .where('name', isEqualTo: name)
          .get();
      return snap.docs.map(DocumentModel.fromFirestore).toList();
    } catch (e) {
      throw ErrorTranslator.translate(e);
    }
  }
}
