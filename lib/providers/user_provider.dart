import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../data/models/user_model.dart';
import '../data/repositories/user_repository.dart';
import 'auth_provider.dart';

final userRepositoryProvider = Provider<UserRepository>(
  (ref) => UserRepository(),
);

/// Watches the current user's Firestore document.
///
/// Forces a token refresh before opening the snapshot stream so that
/// Firestore accepts the auth credentials on the very first read.
/// This prevents the permission-denied error that appears on cold login
/// before the SDK has propagated the new token.
final currentUserProvider = StreamProvider<UserModel?>((ref) async* {
  final firebaseUser = ref.watch(currentFirebaseUserProvider);
  if (firebaseUser == null) {
    yield null;
    return;
  }

  // Firestore `users` collection is the source of truth for personal details.
  // We simply listen to the document so that changes made from the web app
  // (which update Firestore directly) are immediately reflected here.
  yield* ref.watch(userRepositoryProvider).watchUser(firebaseUser.uid);
});

final userProvider = StreamProvider.family<UserModel?, String>((ref, uid) {
  return ref.watch(userRepositoryProvider).watchUser(uid);
});

final allUsersProvider = StreamProvider<List<UserModel>>((ref) {
  return ref.watch(userRepositoryProvider).watchAllUsers();
});

final usersByRoleProvider = StreamProvider.family<List<UserModel>, String>((
  ref,
  roleId,
) {
  return ref.watch(userRepositoryProvider).watchUsersByRole(roleId);
});
