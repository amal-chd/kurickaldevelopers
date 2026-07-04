import 'package:cloud_firestore/cloud_firestore.dart';
import '../models/project_model.dart';
import '../models/milestone_model.dart';
import '../../core/utils/error_translator.dart';

class ProjectRepository {
  final _db = FirebaseFirestore.instance;

  CollectionReference get _projects => _db.collection('projects');

  Stream<List<ProjectModel>> watchUserProjects(List<String> projectIds) {
    if (projectIds.isEmpty) return Stream.value([]);
    return _projects
        .where(FieldPath.documentId, whereIn: projectIds)
        .snapshots()
        .map((s) => s.docs.map(ProjectModel.fromFirestore).toList())
        .handleError((e) => throw ErrorTranslator.translate(e));
  }

  /// Projects the user belongs to. Sourced from the project's own membership
  /// (not the user's projectIds, which can be stale). The project manager is
  /// always kept in memberIds (see create/edit), so this single membership
  /// query covers members and managers and never risks a permission error.
  Stream<List<ProjectModel>> watchMyProjects(String uid, [int attempt = 0]) async* {
    try {
      await for (final s in _projects.where('memberIds', arrayContains: uid).snapshots()) {
        final list = s.docs.map(ProjectModel.fromFirestore).toList()
          ..sort((x, y) => y.createdAt.compareTo(x.createdAt));
        yield list;
      }
    } on FirebaseException catch (e) {
      if ((e.code == 'permission-denied' || e.code == 'unavailable') && attempt < 5) {
        await Future.delayed(Duration(milliseconds: 500 * (attempt + 1)));
        yield* watchMyProjects(uid, attempt + 1);
      } else {
        throw ErrorTranslator.translate(e);
      }
    } catch (e) {
      throw ErrorTranslator.translate(e);
    }
  }

  Stream<List<ProjectModel>> watchAllProjects([int attempt = 0]) async* {
    try {
      await for (final s in _projects.orderBy('createdAt', descending: true).snapshots()) {
        yield s.docs.map(ProjectModel.fromFirestore).toList();
      }
    } on FirebaseException catch (e) {
      if ((e.code == 'permission-denied' || e.code == 'unavailable') && attempt < 5) {
        await Future.delayed(Duration(milliseconds: 500 * (attempt + 1)));
        yield* watchAllProjects(attempt + 1);
      } else {
        throw ErrorTranslator.translate(e);
      }
    } catch (e) {
      throw ErrorTranslator.translate(e);
    }
  }

  Stream<ProjectModel?> watchProject(String projectId, [int attempt = 0]) async* {
    try {
      await for (final doc in _projects.doc(projectId).snapshots()) {
        if (!doc.exists) {
          yield null;
        } else {
          yield ProjectModel.fromFirestore(doc);
        }
      }
    } on FirebaseException catch (e) {
      if ((e.code == 'permission-denied' || e.code == 'unavailable') && attempt < 5) {
        await Future.delayed(Duration(milliseconds: 500 * (attempt + 1)));
        yield* watchProject(projectId, attempt + 1);
      } else {
        throw ErrorTranslator.translate(e);
      }
    } catch (e) {
      throw ErrorTranslator.translate(e);
    }
  }

  Future<ProjectModel?> getProject(String projectId) async {
    try {
      final doc = await _projects.doc(projectId).get();
      if (!doc.exists) return null;
      return ProjectModel.fromFirestore(doc);
    } catch (e) {
      throw ErrorTranslator.translate(e);
    }
  }

  Future<String> createProject(ProjectModel project) async {
    try {
      final doc = await _projects.add(project.toFirestore());
      return doc.id;
    } catch (e) {
      throw ErrorTranslator.translate(e);
    }
  }

  Future<void> updateProject(
    String projectId,
    Map<String, dynamic> data,
  ) async {
    try {
      await _projects.doc(projectId).update(data);
    } catch (e) {
      throw ErrorTranslator.translate(e);
    }
  }

  // Milestones
  CollectionReference _milestones(String projectId) =>
      _projects.doc(projectId).collection('milestones');

  Stream<List<MilestoneModel>> watchMilestones(String projectId) {
    return _milestones(projectId)
        .orderBy('dueDate')
        .snapshots()
        .map((s) => s.docs.map(MilestoneModel.fromFirestore).toList())
        .handleError((e) => throw ErrorTranslator.translate(e));
  }

  Future<String> createMilestone(
    String projectId,
    MilestoneModel milestone,
  ) async {
    try {
      final doc = await _milestones(projectId).add(milestone.toFirestore());
      return doc.id;
    } catch (e) {
      throw ErrorTranslator.translate(e);
    }
  }

  Future<void> updateMilestone(
    String projectId,
    String milestoneId,
    Map<String, dynamic> data,
  ) async {
    try {
      await _milestones(projectId).doc(milestoneId).update(data);
    } catch (e) {
      throw ErrorTranslator.translate(e);
    }
  }

  Future<void> deleteProject(String projectId) async {
    try {
      // Best-effort milestone cleanup — these writes require projects_edit or
      // isProjectManager per the rules, and a user with only projects_delete
      // would fail the batch. Skip failures so the project delete still
      // proceeds; orphans can be cleaned up by a Cloud Function.
      try {
        final milestones = await _milestones(projectId).get();
        if (milestones.docs.isNotEmpty) {
          final batch = _db.batch();
          for (final doc in milestones.docs) {
            batch.delete(doc.reference);
          }
          await batch.commit();
        }
      } catch (_) {
        // Ignore — the parent project delete is what matters to the user.
      }

      // Delete the project document itself.
      await _projects.doc(projectId).delete();
    } catch (e) {
      throw ErrorTranslator.translate(e);
    }
  }
}
