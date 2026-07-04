import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';

class FirebaseService {
  static FirebaseFirestore get db => FirebaseFirestore.instance;
  static FirebaseAuth get auth => FirebaseAuth.instance;

  static Future<void> runBatchUpdate(List<Map<String, dynamic>> updates) async {
    final batch = db.batch();
    for (final update in updates) {
      final ref = update['ref'] as DocumentReference;
      final data = update['data'] as Map<String, dynamic>;
      batch.update(ref, data);
    }
    await batch.commit();
  }
}
