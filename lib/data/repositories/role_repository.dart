import 'package:cloud_firestore/cloud_firestore.dart';
import '../models/role_model.dart';
import '../../core/utils/error_translator.dart';

class RoleRepository {
  final _db = FirebaseFirestore.instance;

  CollectionReference get _roles => _db.collection('roles');

  Stream<List<RoleModel>> watchAllRoles([int attempt = 0]) async* {
    try {
      await for (final s in _roles.snapshots()) {
        yield s.docs.map(RoleModel.fromFirestore).toList();
      }
    } on FirebaseException catch (e) {
      if ((e.code == 'permission-denied' || e.code == 'unavailable') && attempt < 5) {
        await Future.delayed(Duration(milliseconds: 500 * (attempt + 1)));
        yield* watchAllRoles(attempt + 1);
      } else {
        throw ErrorTranslator.translate(e);
      }
    } catch (e) {
      throw ErrorTranslator.translate(e);
    }
  }

  Stream<RoleModel?> watchRole(String roleId, [int attempt = 0]) async* {
    try {
      await for (final doc in _roles.doc(roleId).snapshots()) {
        if (!doc.exists) {
          yield null;
        } else {
          yield RoleModel.fromFirestore(doc);
        }
      }
    } on FirebaseException catch (e) {
      if ((e.code == 'permission-denied' || e.code == 'unavailable') && attempt < 5) {
        await Future.delayed(Duration(milliseconds: 500 * (attempt + 1)));
        yield* watchRole(roleId, attempt + 1);
      } else {
        throw ErrorTranslator.translate(e);
      }
    } catch (e) {
      throw ErrorTranslator.translate(e);
    }
  }

  Future<RoleModel?> getRole(String roleId) async {
    try {
      final doc = await _roles.doc(roleId).get();
      if (!doc.exists) return null;
      return RoleModel.fromFirestore(doc);
    } catch (e) {
      throw ErrorTranslator.translate(e);
    }
  }

  Future<String> createRole(RoleModel role) async {
    try {
      final doc = await _roles.add(role.toFirestore());
      return doc.id;
    } catch (e) {
      throw ErrorTranslator.translate(e);
    }
  }

  Future<void> updateRole(String roleId, Map<String, dynamic> data) async {
    try {
      await _roles.doc(roleId).update(data);
    } catch (e) {
      throw ErrorTranslator.translate(e);
    }
  }

  Future<void> deleteRole(String roleId) async {
    try {
      await _roles.doc(roleId).delete();
    } catch (e) {
      throw ErrorTranslator.translate(e);
    }
  }
}
