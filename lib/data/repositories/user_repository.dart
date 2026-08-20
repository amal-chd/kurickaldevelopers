import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/foundation.dart';
import '../models/user_model.dart';
import '../services/push_sender.dart';
import '../../core/utils/error_translator.dart';

class UserRepository {
  final _db = FirebaseFirestore.instance;

  CollectionReference get _users => _db.collection('users');

  /// Watches a user document, auto-retrying on permission-denied errors.
  /// This self-heals the token timing race on first login — if the Firestore
  /// SDK fires before the auth token propagates, we wait 1 s and retry.
  Stream<UserModel?> watchUser(String uid, [int attempt = 0]) async* {
    try {
      await for (final doc in _users.doc(uid).snapshots()) {
        yield doc.exists ? UserModel.fromMap(doc.data() as Map<String, dynamic>, doc.id) : null;
      }
    } on FirebaseException catch (e) {
      if ((e.code == 'permission-denied' || e.code == 'unavailable') && attempt < 6) {
        // Token not ready yet or transient network issue — wait and retry with exponential back-off.
        debugPrint('watchUser ${e.code} (attempt $attempt) — retrying…');
        await Future.delayed(Duration(milliseconds: 600 * (attempt + 1)));
        yield* watchUser(uid, attempt + 1);
      } else {
        throw ErrorTranslator.translate(e);
      }
    } catch (e) {
      throw ErrorTranslator.translate(e);
    }
  }

  Future<UserModel?> getUser(String uid) async {
    try {
      final doc = await _users.doc(uid).get();
      if (!doc.exists) return null;
      return UserModel.fromMap(doc.data() as Map<String, dynamic>, doc.id);
    } catch (e) {
      throw ErrorTranslator.translate(e);
    }
  }

  Future<void> createUser(UserModel user) async {
    try {
      await _users.doc(user.uid).set(user.toFirestore());
    } catch (e) {
      throw ErrorTranslator.translate(e);
    }
  }

  Future<void> updateUser(String uid, Map<String, dynamic> data) async {
    try {
      await _users.doc(uid).update(data);
    } catch (e) {
      throw ErrorTranslator.translate(e);
    }
  }

  Future<void> updateFcmToken(String uid, String token) async {
    await _users.doc(uid).update({'fcmToken': token});
  }

  Stream<List<UserModel>> watchProjectMembers(List<String> memberIds) {
    if (memberIds.isEmpty) return Stream.value([]);
    return _users
        .where(FieldPath.documentId, whereIn: memberIds)
        .snapshots()
        .map((s) => s.docs.map((d) => UserModel.fromMap(d.data() as Map<String, dynamic>, d.id)).cast<UserModel>().toList())
        .handleError((e) => throw ErrorTranslator.translate(e));
  }

  Future<List<UserModel>> getAllUsers() async {
    try {
      final snap = await _users.orderBy('name').get();
      return snap.docs.map((d) => UserModel.fromMap(d.data() as Map<String, dynamic>, d.id)).cast<UserModel>().toList();
    } catch (e) {
      throw ErrorTranslator.translate(e);
    }
  }

  Future<void> setUserActive(String uid, bool isActive) async {
    try {
      await _users.doc(uid).update({'isActive': isActive});
    } catch (e) {
      throw ErrorTranslator.translate(e);
    }
  }

  Future<void> changeUserRole(String uid, String roleId) async {
    try {
      await _users.doc(uid).update({'roleId': roleId});
    } catch (e) {
      throw ErrorTranslator.translate(e);
    }
  }

  Future<void> deleteUser(String uid) async {
    try {
      // 1. Delete user from Firebase Auth and other related tables using serverless backend
      await PushSender.instance.deleteUser(targetUid: uid);

      // 2. Delete the user's primary Firestore document
      await _users.doc(uid).delete();
    } catch (e) {
      throw ErrorTranslator.translate(e);
    }
  }

  Future<void> updateUserDetails(String uid, Map<String, dynamic> data) async {
    await _users.doc(uid).update(data);
  }

  /// Streams all users for pickers (e.g. starting a DM). Robust by design:
  ///  • no orderBy (so users without a `name` still appear) — sorted client-side
  ///  • skips any single malformed doc instead of failing the whole list
  ///  • retries on permission-denied (token not yet propagated after sign-in)
  Stream<List<UserModel>> watchAllUsers([int attempt = 0]) async* {
    try {
      await for (final snap in _users.snapshots()) {
        final users = <UserModel>[];
        for (final d in snap.docs) {
          try {
            users.add(UserModel.fromMap(d.data() as Map<String, dynamic>, d.id));
          } catch (_) {
            // skip a malformed user doc rather than break the whole picker
          }
        }
        users.sort(
          (a, b) => (a.name.isEmpty ? a.email : a.name)
              .toLowerCase()
              .compareTo((b.name.isEmpty ? b.email : b.name).toLowerCase()),
        );
        yield users;
      }
    } on FirebaseException catch (e) {
      if ((e.code == 'permission-denied' || e.code == 'unavailable') &&
          attempt < 5) {
        await Future.delayed(Duration(milliseconds: 500 * (attempt + 1)));
        yield* watchAllUsers(attempt + 1);
      } else {
        throw ErrorTranslator.translate(e);
      }
    } catch (e) {
      throw ErrorTranslator.translate(e);
    }
  }

  Stream<List<UserModel>> watchUsersByRole(String roleId) {
    return _users
        .where('roleId', isEqualTo: roleId)
        .where('isActive', isEqualTo: true)
        .snapshots()
        .map((s) => s.docs.map((d) => UserModel.fromMap(d.data() as Map<String, dynamic>, d.id)).cast<UserModel>().toList())
        .handleError((e) => throw ErrorTranslator.translate(e));
  }
}
