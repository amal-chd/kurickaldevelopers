import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../data/models/project_model.dart';
import '../data/models/milestone_model.dart';
import '../data/repositories/project_repository.dart';
import 'user_provider.dart';

final projectRepositoryProvider = Provider<ProjectRepository>(
  (ref) => ProjectRepository(),
);

final projectsProvider = StreamProvider<List<ProjectModel>>((ref) {
  final user = ref.watch(currentUserProvider).value;
  if (user == null) return Stream.value([]);

  return ref.watch(projectRepositoryProvider).watchMyProjects(user.uid);
});

final allProjectsProvider = StreamProvider<List<ProjectModel>>((ref) {
  return ref.watch(projectRepositoryProvider).watchAllProjects();
});

final projectProvider = StreamProvider.family<ProjectModel?, String>((
  ref,
  projectId,
) {
  return ref.watch(projectRepositoryProvider).watchProject(projectId);
});

final milestonesProvider = StreamProvider.family<List<MilestoneModel>, String>((
  ref,
  projectId,
) {
  return ref.watch(projectRepositoryProvider).watchMilestones(projectId);
});
